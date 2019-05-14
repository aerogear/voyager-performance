import gql from 'graphql-tag';
import {createClient} from '@aerogear/voyager-client';
import moment from 'moment';
import _ from 'lodash';

import {
  ToggleableNetworkStatus,
  waitFor,
  storageUsage
} from './utils';
import { url } from './config.json';

const networkStatus = new ToggleableNetworkStatus();

const config = {
  httpUrl: `http://${url}/graphql`,
  wsUrl: `ws://${url}/graphql`,
  networkStatus
};

export const simpleMutation = { mutation: gql`mutation { createItem }` };

export const largeMutation = {
  mutation: gql`mutation createItem($data: String) {
    createItem(data: $data)
  }`,
  variables: { data: _.range(10 * 1000).map(i => i).join('') }
};

const complexData = {};
_.range(25).map(i => complexData[`test${i}`] = `test text ${i}`)
_.range(25, 50).map(i => complexData[`test${i}`] = i)
_.range(50, 75).map(i => complexData[`test${i}`] = i + 0.5)
_.range(75, 100).map(i => complexData[`test${i}`] = i % 2 === 0)
_.range(100, 125).map(i => complexData[`test${i}`] = {
  test1: `test text ${i}`,
  test2: i,
  test3: i + 0.5,
  test4: i % 2 === 0
});

export const complexMutation = {
  mutation: gql`mutation createItem($complexData: ComplexInput) {
    createItem(complexData: $complexData)
  }`,
  variables: { complexData }
};

const test = async mutation => {
  const report = {};

  let client;
  try {
    client = await createClient(config);
  } catch (error) {
    document.getElementById('console').innerHTML = error;
    console.error(error);
    throw error;
  }

  for (let numOfMutations = 10; numOfMutations < 1000; numOfMutations *= 2) {
    await client.mutate({ mutation: gql`mutation { deleteAll }` });

    networkStatus.setOnline(false);

    localStorage.setItem('offline-mutation-store', '[]');

    for (let i = 1; i <= numOfMutations; i++) {
      client.mutate(mutation);
    }

    const s = moment();
    client.mutate(mutation);
    const e = moment();
    
    report.createLastMutTime = e.diff(s, 'milliseconds');
    report.numOfOfflineMutations = numOfMutations;
    report.storageUsageKB = storageUsage();

    let ticks = 0;
    const interval = setInterval(() => ticks++, 0);
    const start = moment();
    networkStatus.setOnline(true);
    await waitFor(() => JSON.parse(localStorage.getItem('offline-mutation-store')).length === 0, 1000)
    const end = moment();
    clearInterval(interval);

    report.syncTime = end.diff(start, 'milliseconds');
    report.responsivnessTicks = ticks;

    const { data } = await client.query({
      fetchPolicy: 'network-only',
      query: gql`{items}`
    });

    console.log(data.items);
    console.log(report);

    await client.mutate({
      mutation: gql`
        mutation report($report: Report) {
          report(report: $report)
        }
      `,
      variables: {
        report
      }
    })
  }

  document.getElementById('console').innerHTML = 'DONE';
}

export default test;
