# opsmap [![Build Status](https://travis-ci.org/edinella/opsmap.png?branch=master)](https://travis-ci.org/edinella/opsmap) [![Code Climate](https://codeclimate.com/github/edinella/opsmap.png)](https://codeclimate.com/github/edinella/opsmap)
Map of runnable interdependent operations

[![NPM](https://nodei.co/npm/opsmap.png)](https://npmjs.org/package/opsmap)

## Example

```js
var OpsMap = require('opsmap');
var UserModel = require('./models/user.js');
var BlogModel = require('./models/blog.js');

// declare map of interdependent operations
var blog = new OpsMap('blog');

blog.set('username', 'edinella'); // already resolved values can be setted

blog.op('user', function() {
  return UserModel.findOne({username: 'edinella'}).exec(); // returns a promise
});

blog.op('userPosts', function(user) {
  return BlogModel.find({author: user.id}).exec();
});

// run userPosts operation, returns a promise
blog.run('userPosts').then(yep).fail(nope);

// handle results
function yep(result) {
  console.log(result);
}

// handle errors
function nope(err) {
  console.error(err);
}
```

## How to use
Install with NPM:
```sh
npm install --save opsmap
```

Then require it:
```js
var OpsMap = require('opsmap');
```

## API

**constructor(alias)**: create a new OpsMap with an alias

To produce the instance, `OpsMap` should be called with `new` operator.

```js
var report = new OpsMap('report');
```

**set(token, value)**: defines a value for injection (alias: setCache)

Register the final value.

```js
report.set('dateFormat', 'DD/MM/YYYY HH:mm:ss');
```

**op(token, factoryFn)**: defines a operation that generates a value for injection (alias: operation)

To produce the instance, `factoryFn` will be called once (with instance context) and its result will be used.

The `factoryFn` function arguments should be the tokens of the operations that we need resolved here.

```js
report.op('data', function(filters){
  return MyModel.find(filters).exec();
});
```

**run(token)**: runs an operation, returns a promise

If any operation throws an error or gets rejected, and you omit the rejection handler, the execution will be stopped and error would be forwarded to this resultant promise.

```js
// result is a promise
var myStats = report.run('stats');

// handle results
myStats.then(function(result) {
  console.log(result);
});

// handle errors, including those unhandled from inside operations
myStats.fail(function(err) {
  console.error(err);
});
```
