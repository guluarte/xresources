/// <reference path="q.js" />
/// <reference path="SDK.REST.js" />

if (!Date.now) {
    Date.now = function now() {
        return new Date().getTime();
    };
}

var calendar = (function () {

    var FacilityConstant = "Facility";

    var Q = window.Q;

    var log = function (msg) {
        //console.log(msg);
    };

    var version = "1.7";

    log("Version:" + version);

    var onError = function (error) {
        alert("Operation Failed :" + error.message);
    };

    var retrieveMultipleRecordsPromise = function (entityName, query) {

        var deferred = Q.defer();

        SDK.REST.retrieveMultipleRecords(
            entityName,
            query,
            function (data) {
                deferred.resolve(data);
            },
            function (data) {
                deferred.reject(data);
            },
            function () {
            });

        return deferred.promise;
    };

    var events = [];
    var resources = [];
    var facilities = [];
    var beds = [];

    var getEvents = function () {

        log("Grabbing events");
        events = [];

        var deferred = Q.defer();

        retrieveMultipleRecordsPromise("xrm_ResourceScheduling", "$select=xrm_ResourceSchedulingId,xrm_name,xrm_ContactId,xrm_EndDateOn,xrm_StartDateOn,xrm_ResourceId").then(function (data) {

            // map to the events array
            log(data);

            events = data.map(function (resourceScheduling) {
                return {
                    id: resourceScheduling.xrm_ResourceSchedulingId,
                    resourceId: resourceScheduling.xrm_ResourceId.Id,
                    start: resourceScheduling.xrm_StartDateOn,
                    end: resourceScheduling.xrm_EndDateOn,
                    title: resourceScheduling.xrm_name,
                    allDay: false
                }
            });

            log("Returned events:");

            log(events);

            deferred.resolve(events);

        }, function (error) {

            deferred.reject(error);

        });

        return deferred.promise;
    };

    var getFacilities = function () {

        log("Loading facilities");

        var deferred = Q.defer();

        retrieveMultipleRecordsPromise("xrm_facility", "$select=xrm_name,xrm_facilityId").then(function (data) {

            // map to the beds array
            log(data);

            facilities = [];

            facilities = data.map(function (dataFacilities) {
                return {
                    id: FacilityConstant + dataFacilities.xrm_facilityId,
                    title: dataFacilities.xrm_name
                }
            });

            log("Returned facilities:");

            log(facilities);

            deferred.resolve(facilities);

        }, function (error) {

            deferred.reject(error);

        });

        return deferred.promise;
    };

    var getBeds = function () {

        log("Loading beds");


        var deferred = Q.defer();

        retrieveMultipleRecordsPromise("xrm_resource", "$select=xrm_name,xrm_resourceId,xrm_FacilityId").then(function (data) {

            // map to the beds array
            log(data);

            beds =[];

            beds = data.map(function (dataBeds) {
                return {
                    id: dataBeds.xrm_resourceId,
                    title: dataBeds.xrm_name,
                    parentId: FacilityConstant + dataBeds.xrm_FacilityId.Id,
                    eventColor: "#002050"
                }
            });

            log("Returned beds:");

            log(beds);

            deferred.resolve(beds);

        }, function (error) {

            deferred.reject(error);

        });

        return deferred.promise;
    };

    var getResources = function () {
        log("Grabbing resources");

        resources =[];

        var deferred = Q.defer();

        getBeds()
            .then(getFacilities)
            .done(function () {

                // map beds and facilities to resources

                facilities.forEach(function (facility) {
                    // find bed children
                    facility["children"] = [];

                    beds.forEach(function (bed) {

                        if (bed.parentId === facility.id) {
                            facility["children"].push(bed);
                        }

                    });

                });

                resources = facilities;

                deferred.resolve(resources);
            });

        return deferred.promise;
    };

    var eventAllow = function (dropLocation, draggedEvent) {
        log(dropLocation);
        log(draggedEvent);
        return dropLocation.resourceId.indexOf(FacilityConstant) === -1;
    };

    var updateEvent = function (event) {
        log("Update");
        log(event);

        var eventCrm = {
            xrm_ResourceId: {
                Id: event.resourceId,
                LogicalName: "xrm_resource"
            },
            xrm_StartDateOn: event.start.format(),
            xrm_EndDateOn: event.end.format()

        };

        log(eventCrm);

        SDK.REST.updateRecord(event.id, eventCrm,"xrm_ResourceScheduling",
                        function (record) {
                        },
                        function (data) {
                            onError(data);
                        });
    };

    var eventDrop = function (event, jsEvent, ui, view) {
        updateEvent(event);

    };

    var eventResize = function (event, jsEvent, ui, view) {
        updateEvent(event);
    };

    var eventClick = function (event) {
        Xrm.Utility.openEntityForm("xrm_resourcescheduling", event.id, null, {
            openInNewWindow: true
        });
    };

    var Start = function () {
        log("Load");
        getEvents()
            .then(getResources)
            .then(function () {
                log("Setting calendar");
                log(events);
                log(resources);
                $("#calendar").fullCalendar({
                    schedulerLicenseKey: "CC-Attribution-NonCommercial-NoDerivatives",
                    now: Date.now(),
                    editable: true,
                    aspectRatio: 1.8,
                    scrollTime: "00:00",
                    timezone:"local",
                    customButtons: {
                        nowButton: {
                            text: "Today",
                            click: function () {
                                $("#calendar").fullCalendar("gotoDate", Date.now());
                            }
                        }
                    },
                    header: {
                        left: "nowButton prev,next",
                        center: "title",
                        right: "timelineDay,timelineWeek,timelineMonth"
                    },
                    defaultView: "timelineWeek",
                    views: {
                        timelineDay: {
                            buttonText: "Day",
                            slotDuration: "01:00:00",
                            snapDuration: "00:30:00"
                        },
                        timelineWeek: {
                            buttonText: "Week",
                            slotDuration: "06:00:00",
                            snapDuration: "00:30:00"
                        },
                        timelineMonth: {
                            buttonText: "Month",
                            slotDuration: "12:00:00",
                            snapDuration: "00:30:00"
                        }
                    },
                    navLinks: true,
                    resourceAreaWidth: "15%",
                    resourceLabelText: "Beds",
                    resources: resources,
                    events: events,
                    eventDrop: eventDrop,
                    eventResize: eventResize,
                    eventAllow: eventAllow,
                    eventClick: eventClick,
                    eventOverlap: function (stillEvent, movingEvent) {
                        //return stillEvent.allDay && movingEvent.allDay;
                        return false;
                    },
                    height: "parent",
                    nowIndicator: true
                });
            }).done();


    };

    var EnableAppRibbon = function () {
        try {
            var schedulerTab = $("#crmContentPanel[src*='calendar.html']");

            if (schedulerTab == null) {
                log("EnableAppRibbon: true");
                return true;
            }
            if (schedulerTab.length > 0) {
                log("EnableAppRibbon: false");
                return false;
            }

        } catch (error) {
            return true;
        }

        return true;
    };

    var DisplaySchedulerButtons = function () {
        return !EnableAppRibbon();
    }

    var reload = function () {
        log("reloading");
        window.location.reload(true);
    };

    var openQuickForm = function (entityName) {

        Xrm.Utility.openQuickCreate(entityName).then(function (data) {
            log(data);
            reload();
        }, function (error) {
            log(error);
        });
    };

    var OpenCreateNewResource = function () {

        openQuickForm("xrm_resource");
    };

    var OpenCreateNewFacility = function () {

        openQuickForm("xrm_facility");

    };

    var OpenCreateNewBedScheduling = function () {

        openQuickForm("xrm_resourcescheduling");

    };

    return {
        Start: Start,
        EnableAppRibbon: EnableAppRibbon,
        DisplaySchedulerButtons: DisplaySchedulerButtons,
        OpenCreateNewResource: OpenCreateNewResource,
        OpenCreateNewFacility: OpenCreateNewFacility,
        OpenCreateNewBedScheduling: OpenCreateNewBedScheduling
    };
})();
