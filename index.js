'use strict';

const aws = require('aws-sdk');

aws.config = new aws.Config();
aws.config.accessKeyId = "";
aws.config.secretAccessKey = "";

const shell = require('child_process').spawnSync;

const route = new aws.Route53();

const getHostedZoneDomainId = () => {
  return new Promise((resolve, reject) => {
    route.listHostedZones({}, (err, data) => {
      if (!err) {
        const id = data.HostedZones
          .filter(x => x.Name === process.env.ZONE)
          .map(x => x.Id)[0]
          .split('/')[2];
        resolve(id);
      } else {
        reject(err);
      }
    });
  });
};

const getCurrentRecordSets = id => {
  return new Promise((resolve, reject) => {
    route.listResourceRecordSets({ HostedZoneId: id }, (err, data) => {
      if (!err) {
        const resourceRecordSets = data.ResourceRecordSets.filter(x => x.TTL === 300);
        resolve(resourceRecordSets)
      } else {
        reject(err);
      }
    });
  });
};

const getCurrentHomeIp = () => {
  const ip = shell('dig', [
    '+short',
    'myip.opendns.com',
    '@resolver1.opendns.com',
  ]);
  return ip.stdout.toString();
};

const updateDNS = (id, ip) => {
  const params1 = {
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: process.env.DOMAIN,
            Type: 'A',
            ResourceRecords: [
              {
                Value: ip,
              },
            ],
            TTL: 300,
          },
        },
      ],
    },
    HostedZoneId: id,
  };
  const params2 = {
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: 'www.' + process.env.DOMAIN,
            Type: 'A',
            ResourceRecords: [
              {
                Value: ip,
              },
            ],
            TTL: 300,
          },
        },
      ],
    },
    HostedZoneId: id,
  };
  route.changeResourceRecordSets(params1, (err, data) => {
    if (!err) {
      console.log(data);
    } else {
      console.error(err);
    }
  });
  route.changeResourceRecordSets(params2, (err, data) => {
    if (!err) {
      console.log(data);
    } else {
      console.error(err);
    }
  });
};


getHostedZoneDomainId().then(id => {
  const digIp = getCurrentHomeIp();
  getCurrentRecordSets(id).then(resourceRecordSets => {
    resourceRecordSets.forEach(x => {
      if (x.ResourceRecords[0].Value.trim() !== digIp.trim()) {
        updateDNS(id, digIp);
      }
    });
  });
});
