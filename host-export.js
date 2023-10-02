import { monitoredEntitiesClient } from "@dynatrace-sdk/client-classic-environment-v2";

export default async function () {
  //import all hosts
  let hostResponse = await importHosts();
  convertHostsToList(hostResponse);
  //console.log(hostResponse)
  //handle a case when there is a lot of hosts
  while (hostResponse.nextPageKey){
  hostResponse = await importHostsNextPage(hostResponse.nextPageKey);
  convertHostsToList(hostResponse);
  }
} 


function importHosts() {
let hosts = monitoredEntitiesClient.getEntities({
  entitySelector: 'type("HOST")',
  fields: 'properties',
  from: "now-2h"
});
  return hosts;
}

function importHostsNextPage(_nextPageKey) {
let hosts = monitoredEntitiesClient.getEntities({
  nextPageKey: _nextPageKey
});
  return hosts;
}


//convert the JSON response to a list of hosts + apply logic to filter further
function convertHostsToList(hosts){
    for (var host in hosts.entities){
      if(hosts.entities[host].properties.isMonitoringCandidate === false)
        console.log(hosts.entities[host].displayName);
      }
}