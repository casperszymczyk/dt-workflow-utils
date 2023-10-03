  // optional import of sdk modules
import { monitoredEntitiesClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { extensions_2_0Client } from "@dynatrace-sdk/client-classic-environment-v2";
import { credentialVaultClient } from '@dynatrace-sdk/client-classic-environment-v2';

var processList = [];
var hostList = [];
var endpointList = [];
var endpointListDCA = [];
var endpointListDCB = [];
var endpointListAZURE = [];
var monitoringConfigListDCA = ["dfb27f9a-a0c5-3443-9e5d-541e4d727197","ff1a79e6-7d7b-395a-9e5c-9c0c0a3fe1d1","23a768b5-f0bb-3ff8-af87-662bc774a8ed","76c817e8-67bc-3dd7-b235-4e23c1637a0b","49db28d0-66c8-3128-9bb7-6cca4eaf5e4d"];
var monitoringConfigListDCB = ["16847043-1bff-3c7a-837f-0b75a82eb46e","a541fddc-1b48-35e1-9f53-9b3366fcf49e","2f0d370a-836d-3dfa-9a41-0f17db084201", "4b81682e-b8b2-3ba5-80b4-d68ba02bc3a2"];
var monitoringConfigListAZURE = ["803be5a6-ae1f-3388-baf1-b86b56998cdf"];
const credentials = await credentialVaultClient.getCredentialsDetails({
  id: 'CREDENTIALS_VAULT-55F1B14E92227D3D',
});


export default async function () {
  //import all hosts in the SQL_GENERIC MZ
  let hostResponse = await importHosts();
  //console.log(hostResponse);
  convertHostsToList(hostResponse);
  //handle a case when there is a lot of hosts
  
  while (hostResponse.nextPageKey){
  hostResponse = await importHostsNextPage(hostResponse.nextPageKey);
  convertHostsToList(hostResponse);
  }
  //import all processes 
  let processResponse = await importProcesses();
  //console.log(processResponse)
  convertProcessesToList(processResponse);
  //handle a case when there is a lot of processes
  
  while (processResponse.nextPageKey){
  processResponse = await importProcessesNextPage(processResponse.nextPageKey);
  convertProcessesToList(processResponse);
  //console.log(processList);
  }

  //link the process information and host information by hostID (index 0 of both subarrays)
  //add the mssqlInstanceName, listen ports, hostname and network zone to the storage
  for (var process in processList){
    for (var host in hostList){
  let index = hostList[host][0].indexOf(processList[process][0])
  if(index !== -1){
  endpointList.push((processList[process].concat(hostList[host])))
  }
  }
  }
//split the master list into 3 lists depending on the network zone
  for (var endpoint in endpointList){
    if (endpointList[endpoint][5] === "onprem.dca.preprod"){
      endpointListDCA.push(endpointList[endpoint]);
    } else if (endpointList[endpoint][5] === "onprem.dcb.preprod"){
      endpointListDCB.push(endpointList[endpoint]);
    } else if (endpointList[endpoint][5] === "azure.preprod"){
      endpointListAZURE.push(endpointList[endpoint]);
    }
  }
//upload endpoint lists into every relevant configuration(s)
  let response = await uploadExtensionConfig(monitoringConfigListDCA, "onprem.dca.preprod", endpointListDCA, "Auto-Detection List (DCa)");
  console.log(response);
  response = await uploadExtensionConfig(monitoringConfigListDCB, "onprem.dcb.preprod", endpointListDCB, "Auto-Detection List (DCb)");
  console.log(response);
  response = await uploadExtensionConfig(monitoringConfigListAZURE, "azure.preprod", endpointListAZURE, "Auto-Detection List (Azure)");
  console.log(response);
  //replace values for each endpoint and push configuration once 100 endpoints is reached
  //console.log(hostList);
  //console.log(processList);
  //console.log(endpointListAZURE);
  //console.log(endpointListDCA);
  //console.log(endpointListDCB);
  //console.log(response);
} 


function importHosts() {
let hosts = monitoredEntitiesClient.getEntities({
  entitySelector: 'type("HOST"),mzName("SQL_GENERIC")',
  fields: 'properties,managementZones'
});
  return hosts;
}

function importHostsNextPage(_nextPageKey) {
let hosts = monitoredEntitiesClient.getEntities({
  nextPageKey: _nextPageKey
});
  return hosts;
}

function importProcessesNextPage(_nextPageKey) {
let processes = monitoredEntitiesClient.getEntities({
  nextPageKey: _nextPageKey
});
  return processes;
}

function importProcesses() {
  let processes = monitoredEntitiesClient.getEntities({
  entitySelector: 'type("PROCESS_GROUP_INSTANCE"),mzName("SQL_GENERIC"),tag("SQL Instance Name")',
  fields: 'properties,fromRelationships,tags'
});
  return processes;
}

//convert the JSON response to a list of processes + apply logic to filter further
function convertProcessesToList(processes){
  //console.log(processes)
  for (var process in processes.entities){
    //console.log(JSON.stringify(processes.entities[process].tags));
    if (!(processes.entities[process].tags && JSON.stringify(processes.entities[process].tags).includes("doNotMonitor"))){
    let runningOn = processes.entities[process].fromRelationships.isProcessOf[0].id;
    if (processes.entities[process].properties.listenPorts){
    var listeningOn = processes.entities[process].properties.listenPorts[0];
    } 
    else
    {
      var listeningOn = 1433;
    } 
    if (processes.entities[process].properties.metadata){
    var instanceName = processes.entities[process].properties.detectedName;
    } 
    else
    {
      var instanceName = "n/a"
    } 
    processList.push([runningOn,listeningOn,instanceName]);
    //console.log(processes.entities[process])
    }
  }
}

//convert the JSON response to a list of hosts + apply logic to filter further
function convertHostsToList(hosts){
    for (var host in hosts.entities){
      //console.log(hosts.entities[host]);
      if (hosts.entities[host].properties.networkZone){
        hostList.push([hosts.entities[host].entityId,hosts.entities[host].displayName,hosts.entities[host].properties.networkZone]);
        }
      }
}

//upload the the configurations having in mind the 100 endpoints limit (in which case we split the list into multiple lists and push only first 100)
function uploadExtensionConfig(configArray, networkZone, list, configurationName){
  var configIndex = 0;
  let response;
  if (list.length > 100){
      console.log(configID);
      console.log("list longer than 100 endpoints. splicing and sending 100...");
      var partList = list.splice(0, 99);
  
  let payload = buildJSONPayload(networkZone, partList, configurationName,configIndex)
  let response = extensions_2_0Client.updateMonitoringConfiguration({
  extensionName: "com.dynatrace.extension.sql-server",
  configurationId: configArray[configIndex],
  body: JSON.parse(payload),
});
    uploadExtensionConfig(configID, networkZone, list, configurationName);
    configIndex++;
  }
  else
  {
   console.log("list shorter than 100 endpoints. good!");
  let payload = buildJSONPayload(networkZone, list, configurationName,configIndex)
  let response = extensions_2_0Client.updateMonitoringConfiguration({
  extensionName: "com.dynatrace.extension.sql-server",
  configurationId: configArray[configIndex],
  body: JSON.parse(payload),
  });
    }
return(response);
  }

//build the JSON payload for the extension configuration
function buildJSONPayload(networkZone, list, configurationName, configIndex){
  var endpointJSONList = [];
  for (var endpoint in list){
    endpointJSONList.push(buildSingleEndpoint(list[endpoint][4], list[endpoint][1], list[endpoint][2]));
  }
  var payload = 
  {
  "value": {
    "enabled": true,
    "description": configurationName + ' ' + (configIndex+1),
    "version": "1.2.5",
    "featureSets": [
      "Always On: Availability Replica Metrics",
      "Backup Metrics",
      "Always On: Availability Group Metrics",
      "Always On: Availability Database Metrics",
      "Database Metrics",
      "Host Attributes",
      "Instance Metrics"
    ],
    "sqlServerRemote": {
      "endpoints": [
      ] 
    }
  },
  "scope": "ag_group-" + networkZone
}
  payload.value.sqlServerRemote.endpoints = endpointJSONList;
  console.log(JSON.stringify(payload));
  return JSON.stringify(payload);
}

//build a single endpoint for the JSON payload
function buildSingleEndpoint(hostName, port, instanceName){
  let content = {
  "host": hostName,
  "port": port,
  "instanceName": instanceName,
  "databaseName": "",
  "authentication": {
    "scheme": "ntlm",
    "username": credentials.username,
    "password": credentials.password,
    "domain": null
  },
  "ssl": true,
  "validateCertificates": false
}
  //console.log(content);
  return content;
}