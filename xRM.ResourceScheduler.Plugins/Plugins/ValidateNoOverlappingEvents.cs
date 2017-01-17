using Microsoft.Xrm.Sdk;
using System;

using Microsoft.Xrm.Sdk.Query;

namespace xRM.ResourceScheduler.Plugins.Plugins
{
    public class ValidateNoOverlappingEvents : IPlugin
    {
        #region Secure/Unsecure Configuration Setup
        private string _secureConfig = null;
        private string _unsecureConfig = null;
        private ITracingService _tracer;
        private IOrganizationService _service;

        public ValidateNoOverlappingEvents(string unsecureConfig, string secureConfig)
        {
            _secureConfig = secureConfig;
            _unsecureConfig = unsecureConfig;
        }
        #endregion
        public void Execute(IServiceProvider serviceProvider)
        {
            _tracer = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            IPluginExecutionContext context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            IOrganizationServiceFactory factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            _service = factory.CreateOrganizationService(context.UserId);

            try
            {

                _tracer.Trace("Starting [ValidateNoOverlappingEvents]");

                Entity entity = (Entity)context.InputParameters["Target"];

                var startDate = entity.GetAttributeValue<DateTime>("xrm_startdateon");
                var endDate = entity.GetAttributeValue<DateTime>("xrm_enddateon");
                var resourceRef = entity.GetAttributeValue<EntityReference>("xrm_resourceid");
                // grab all the events with the entity start, end date and bed

                _tracer.Trace(string.Format("Values startDate:{0}, endDate:{1}", startDate, endDate));

                if (resourceRef != null)
                {
                    _tracer.Trace(string.Format("Values resourceRef:{0}", resourceRef.Id));
                } else {
                    _tracer.Trace("Resource Id Is null");
                    throw new Exception("Schedulings must have a bed associated.");
                }

                if (NumEventsInQuery(startDate, endDate, entity.Id, resourceRef.Id) > 0)
                {
                    throw new Exception("There is another scheduling in the interval selected.");
                }


            }
            catch (Exception e)
            {
                throw new InvalidPluginExecutionException(e.Message);
            }
        }


        private int NumEventsInQuery(DateTime startDate, DateTime endDate, Guid ignoreId, Guid resourceId)
        {

            var events = EventsInsideInterval(startDate, endDate, ignoreId, resourceId);

            if (events == null)
            {
                return 0;
            }

            return events.Count;
        }

        public DataCollection<Entity> EventsInsideInterval(DateTime startDate, DateTime endTime, Guid ignoreId, Guid resourceId)
        {

            QueryExpression query = new QueryExpression
            {
                EntityName = "xrm_resourcescheduling",
                ColumnSet = new ColumnSet("xrm_resourceschedulingid")
            };

            query.Criteria = new FilterExpression();


            // grabs events inside the interval
            FilterExpression innerEvents = query.Criteria.AddFilter(LogicalOperator.And);

            innerEvents.AddCondition("xrm_startdateon", ConditionOperator.LessThan, endTime);

            innerEvents.AddCondition("xrm_enddateon", ConditionOperator.GreaterThan, startDate);

            innerEvents.AddCondition("xrm_resourceid", ConditionOperator.Equal, resourceId);

            if (ignoreId != Guid.Empty)
            {
                innerEvents.AddCondition("xrm_resourceschedulingid", ConditionOperator.NotEqual, ignoreId);
            }

            return _service.RetrieveMultiple(query).Entities;
        }

    }
}
