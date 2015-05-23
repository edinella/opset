# opset [![Build Status](https://travis-ci.org/edinella/opset.png?branch=master)](https://travis-ci.org/edinella/opset) [![Code Climate](https://codeclimate.com/github/edinella/opset.png)](https://codeclimate.com/github/edinella/opset)
Set of runnable interdependent operations

[![NPM](https://nodei.co/npm/opset.png)](https://npmjs.org/package/opset)

## Example

```js
var OpSet = require('opset');
var UserModel = require('./models/user.js');
var BlogModel = require('./models/blog.js');

// declare set of interdependent operations
var blog = new OpSet('blog');

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
npm install --save opset
```

Then require it:
```js
var OpSet = require('opset');
```

## API

**OpSet(alias)**: constructor, create a new OpSet with an alias

To produce the instance, `OpSet` should be called with `new` operator.

```js
var report = new OpSet('report');
```

**set(token, value)**: alias for setCache()
**setCache(token, value)**: defines a resolved value for injection

Register the final value.

```js
report.set('dateFormat', 'DD/MM/YYYY HH:mm:ss');
```

**op(token, factoryFn)**: alias for operation()
**operation(token, factoryFn)**: defines a operation that generates a value for injection

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
