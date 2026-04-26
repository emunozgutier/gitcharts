const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const fs = require('fs');
const dir = '/tmp/django-test';

git.clone({
  fs,
  http,
  dir,
  url: 'https://github.com/django/django',
  depth: 100,
  singleBranch: true
}).then(() => console.log('success')).catch(e => console.error('error', e));
