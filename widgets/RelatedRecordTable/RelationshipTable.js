define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dojo/dom-class',
    'dojo/_base/array',
    'dojo/_base/lang',
    'esri/request',
    'dojo/store/Memory',
    'dgrid/OnDemandGrid',
    'dgrid/extensions/ColumnHider',
    'dgrid/extensions/DijitRegistry',
    'dojo/topic',
    'dojo/Deferred'
], function (declare, _WidgetBase, DomClass,
        array, lang, request, Memory, OnDemandGrid, ColumnHider, DijitRegistry, topic, Deferred) {
    return declare('RelationshipTable', [_WidgetBase, OnDemandGrid, ColumnHider, DijitRegistry], {
        //object id field for the feature layer (use field alias)
        objectIdField: null,
        //field value mappings of attributes from the feature layer to query related records from
        //should have a field with the same name as objetIdField
        attributes: null,
        //the url to the feature service
        url: '',
        //the relationship id for the feature service relationship
        relationshipId: 0,
        defaultNoDataMessage: 'No results.',
        loadingMessage: 'Loading...',
        baseClass: 'RelationshipTable',
        postCreate: function () {
            this.inherited(arguments);
            if (!this.objectIdField) {
                topic.publish('viewer/handleError', {
                    source: 'RelationshipTable',
                    error: 'This widget requires an objetIdField'
                });
                this.destroy();
            }
            this.store = new Memory({
                idProperty: this.objectIdField
            });
            this.noDataMessage = this.defaultNoDataMessage;
            if (this.attributes) {
                this.getRelatedRecords(this.attributes);
            }
        },
        getRelatedRecords: function (attributes) {
            if (this.deferred) {
                this.deferred.cancel();
            }
            this.store.setData([]);
            this.noDataMessage = this.loadingMessage;
            var objectID = attributes[this.objectIdField];
            if (!objectID) {
                topic.publish('viewer/handleError', {
                    source: 'RelationshipTable',
                    error: this.objectIdField + ' ObjectIDField was not found in attributes'
                });
                return;
            }
            var query = {
                url: this.url,
                objectIds: [objectID],
                outFields: ['*'],
                relationshipId: this.relationshipId
            };
            this.deferred = this._queryRelatedRecords(query);
            this.deferred.then(lang.hitch(this, '_handleRecords'));
            return this.deferred;
        },
        _handleRecords: function (results) {
            this.deferred = null;
            this.noDataMessage = this.defaultNoDataMessage;
            //if we don't have columns set yet
            if (!this.get('columns').length) {
                this.set('columns', array.map(results.fields, lang.hitch(this, function (field) {
                    return {
                        label: field.alias,
                        field: field.name
                    };
                })));
            }
            if (results.relatedRecordGroups.length > 0) {
                array.forEach(results.relatedRecordGroups[0].relatedRecords, lang.hitch(this, '_addRecord'));
                this.refresh();
            }
        },
        _addRecord: function (record) {
            this.store.put(record.attributes);
        },
        /*
         * custom queryRelatedRecords function
         * layer.queryRelatedRecords doesn't return the field 
         * properties such as alias.    
         * @param {object} query - object with the query properties
         * @param function callback - function(responseFields, relatedRecordGroups)
         * query properties:
         *  - url: the url of the featureLayer
         *  - objectIds: [object IDs]
         *  - outFields: ['*'],
         *  - relationshipId: integer
         */
        _queryRelatedRecords: function (query) {
            var deferred = new Deferred();
            new request({
                url: query.url + '/queryRelatedRecords',
                content: {
                    returnGeometry: false,
                    objectIDs: query.objectIds,
                    outFields: query.outFields,
                    relationshipId: query.relationshipId,
                    f: 'json'
                },
                handleAs: 'json',
                load: function (result) {
                    deferred.resolve(result);
                },
                error: function (error) {
                    //console.log(error);
                }
            });
            return deferred;
        },
        resize: function () {
            this.inherited(arguments);
        }
    });
});
