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
var monitoringConfigListDCA = ["e13ec7fa-96a7-3084-836d-38dcfcee6aea","a8e0c9ec-7915-3d4d-acac-e20f87711723","569a923d-bcd4-3e75-9c46-c2875fe3d94c","f3a89ae1-91e1-372a-83e4-de7795917941","ed79e96b-7f4a-3403-a707-1fc80d0d81f4"];
var monitoringConfigListDCB = ["53b17286-d70b-3f48-93f6-e17aaa588d29","0d22d01c-7c3b-35c4-84f5-b5384debc2d4","85961003-c319-3e00-82a7-4c9a6aa9df73", "98e3f83c-0094-396b-a4ae-33584861b6d1","54cb8c52-f100-3ab8-87e4-850f0f44fe89"];
var monitoringConfigListAZURE = ["3474ceab-bc66-397c-91c8-321065be541f"];


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
  //console.log(processResponse.entities[0].properties.metadata["ORACLE_SID"]);
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
    if (endpointList[endpoint][4] === "onprem.dca.preprod"){
      endpointListDCA.push(endpointList[endpoint]);
    } else if (endpointList[endpoint][4] === "onprem.dcb.preprod"){
      endpointListDCB.push(endpointList[endpoint]);
    } else if (endpointList[endpoint][4] === "azure.preprod"){
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
  // console.log(hostList);
  // console.log(processList);
  // console.log(endpointListAZURE);
  // console.log(endpointListDCA);
  // console.log(endpointListDCB);
  // console.log(response);
} 


function importHosts() {
let hosts = monitoredEntitiesClient.getEntities({
  entitySelector: 'type("HOST"),mzName("ORACLE_GENERIC")',
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
  entitySelector: 'type("PROCESS_GROUP_INSTANCE"),mzName("ORACLE_GENERIC"),tag("Oracle SID")',
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
    if (processes.entities[process].properties.metadata){
      for (var key in processes.entities[process].properties.metadata){
        if (processes.entities[process].properties.metadata[key].key === "ORACLE_SID"){
          instanceName = processes.entities[process].properties.metadata[key].value;
        }
      }
    } 
    else
    {
      var instanceName = "n/a"
    } 
    processList.push([runningOn,instanceName]);
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
  extensionName: "com.dynatrace.extension.sql-oracle",
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
    endpointJSONList.push(buildSingleEndpoint(list[endpoint][3], list[endpoint][1]));
  }
  var payload = 
  {
  "value": {
    "enabled": true,
    "description": configurationName + ' ' + (configIndex+1),
    "version": "1.4.0",
    "featureSets": [
      "TopN",
      "io",
      "cpu",
      "sessions",
      "memory",
      "asm",
      "tablespaces",
      "limits",
      "queryPerformance",
      "waitEvents",
      "multitenancy"
    ],
    "sqlOracleRemote": {
      "licenseAccepted": true,
      "endpoints": [
          ]
        }
      },
      "scope": "ag_group-" + networkZone
    }
  payload.value.sqlOracleRemote.endpoints = endpointJSONList;
  console.log(JSON.stringify(payload));
  return JSON.stringify(payload);
}

//build a single endpoint for the JSON payload
function buildSingleEndpoint(hostName, sid){
  let content =  {
  "host": hostName,
  "port": 1521,
  "databaseIdentifier": "sid",
  "authentication": {
    "scheme": "basic",
    "useCredentialVault": true,
    "credentialVaultId": "CREDENTIALS_VAULT-896E96A5724EFEB4"
  },
  "ssl": null,
  "SID": sid
}
  //console.log(content);
  return content;
}
