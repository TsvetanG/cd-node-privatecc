/*
Copyright Chaindigit.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
// DO NOT USE IN PRODUCTION

const shim = require('fabric-shim');
const ClientIdentity = require('fabric-shim').ClientIdentity;

//Used to log
var logger = shim.newLogger('nodepdcc');
// The log level can be set by 'CORE_CHAINCODE_LOGGING_SHIM' to CRITICAL, ERROR, WARNING, DEBUG
logger.level = 'debug';

var Chaincode = class {
	async Init(stub) {
		logger.info('ChainCode Initialize');
		return shim.success();
	}

	async Invoke(stub) {
		logger.info('ChainCode Invoke');
		let fap = stub.getFunctionAndParameters();
		let func = fap.fcn;
		let args = fap.params;

		logger.info('Invoke function' + func);

		if (func === 'query') {
			return this.query(stub, args);
		}

		if (func === 'push') {
			return this.push(stub, args);
		}

		logger.Errorf(`Unknown action: ${func}`);
		return shim.error(`Unknown action: ${func}`);
	}

	async push(stub, args) {
		logger.info("Push private data to the private collection");

		logger.info("Number of parameters: " + args.length);

		if (args.length != 3 ) {
			return shim.error('Expecting client ID , file ID and private data as parameters');
		}
		
		let clientId = args[0];
		
		let hasConsent = await this.isConsentGiven(stub, clientId);
		let callerIdentity = new ClientIdentity(stub);
		let mspId = callerIdentity.getMSPID();
		
		if(hasConsent != true) return shim.error(`Consent not given for client: ${clientId} and MSP: ${mspId}`);
		
		let collection = "coll"; 
		let fileId = args[1];
		logger.info("Private collection name: " + collection);
		logger.info("Private for client : " + clientId + "with filed id: " + fileId + " data : " + args[2]);
		
		
		let key = clientId + "_" + fileId;
		logger.info("Store data with key: " + key);
		await stub.putPrivateData(collection, key, Buffer.from(args[2]));
		logger.info("Private stored with key: " + key);
		
		return shim.success(Buffer.from('move succeed'));
	}

	async query(stub, args) {
		
		logger.info("Query private data");

		logger.info("Number of parameters: " + args.length);

		if (args.length != 2) {
			return shim.error('Expecting client ID and file id as parameters');
		}
		
		let clientId = args[0];
		let fileId = args[1];
		
		let hasConsent = await this.isConsentGiven(stub, clientId);
		let callerIdentity = new ClientIdentity(stub);
		let mspId = callerIdentity.getMSPID();
		
		if(hasConsent != true) {
			logger.info(`No consent for client ${clientId} and MSP ${mspId}`);	
			return shim.error(`Consent not given for client: ${clientId} and MSP: ${mspId}`);
		}
		logger.info("Consent is provided => fetching private data");
		let collection = "coll";
		let key = clientId +  "_" + fileId;
		logger.info(`Fetching data with key ${key}`);
		let prvData = await stub.getPrivateData(collection, key);
		logger.info("Private fetched" + prvData.toString('utf8'));
    	return shim.success(Buffer.from(prvData.toString('utf8')));
	}
	
	async isConsentGiven(stub, clientId) {
		logger.info(`Check consent for client id ${clientId}`);
		let callerIdentity = new ClientIdentity(stub);
		let mspId = callerIdentity.getMSPID();
		
		logger.info(`Caller MSP ID = ${mspId}`);
		logger.info(`Caller ID = ${callerIdentity.getID()}`); 
	 	
		logger.info(`Query consent for client with id: ${clientId}` );
		let channel = '';
		//Call the consent chaincode on the same public channel
		let result = await stub.invokeChaincode('consentcc', [ Buffer.from('query') , Buffer.from(clientId) , Buffer.from(mspId) ] , channel);
		
		let qResp = result.payload.toString('utf8');
		
		logger.info(`Consent query response : ${qResp}` );
		
		let consent = JSON.parse(qResp);
		
		logger.info(`Consent for client: ${consent}` );
		
		logger.info(`Consent for clientID : ${consent.ClientID}` );
		
		if(consent.ClientID !== clientId) {
			logger.info(`Consent not recorded for client: ${clientId}`);
			return false;
		}
		
		let hasConsent = false;
		
		let consentMsp = mspId + ":X";
		
		for (let item in consent.Consents) {
			logger.info(`Check consent loop item: ${consent.Consents[item]}` );
			if(consent.Consents[item] === consentMsp) hasConsent = true;
		}
		
		return hasConsent;
	}


};

//start the chaincode process
shim.start(new Chaincode());