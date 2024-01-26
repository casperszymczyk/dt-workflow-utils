  // optional import of sdk modules
import { settingsObjectsClient } from "@dynatrace-sdk/client-classic-environment-v2";
import { execution } from '@dynatrace-sdk/automation-utils';



var objectList = []
var searchName
var newName
var objectID
var rules
var description

export default async function ({execution_id}) {
  
  const ex = await execution(execution_id);
  searchName = ex.event().previous;
  newName = ex.event().new;
  console.log(ex.event.previous);
  
  let objectResponse = await importObjects();
  objectID = search(objectResponse,searchName);

  while (objectResponse.nextPageKey && objectID == null){
  objectResponse = await importObjectsNextPage(objectResponse.nextPageKey);
  objectID = search(objectResponse,searchName);
  }
  //console.log(objectResponse)
  console.log(objectID)
  if (objectID != null){
  update(objectID, rules, description, newName)
    }
} 

async function importObjects() {
let objects = await settingsObjectsClient.getSettingsObjects({
  schemaIds: "builtin:management-zones"
});
  return objects;
}

async function importObjectsNextPage(_nextPageKey) {
let objects = await settingsObjectsClient.getSettingsObjects({
  nextPageKey: _nextPageKey
});
  return objects;
}

function search(objects, searchName){
    for (var object in objects.items){
      if (objects.items[object].value.name == searchName){
        console.log(objects.items[object].value.name) 
        description = objects.items[object].value.description
        rules = objects.items[object].value.rules
        return objects.items[object].objectId
        }
      } 
}

async function update(_objectID, _rules, _description, _newName){
var response  = await settingsObjectsClient.putSettingsObjectByObjectId({
  objectId: _objectID,
  body: {
    value: {
      name: _newName,
      description: _description,
      rules: _rules
      }
  },
});
}
