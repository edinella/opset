# opset [![Build Status](https://travis-ci.org/edinella/opset.png?branch=master)](https://travis-ci.org/edinella/opset) [![Code Climate](https://codeclimate.com/github/edinella/opset.png)](https://codeclimate.com/github/edinella/opset)
Set of runnable interdependent operations

[![NPM](https://nodei.co/npm/opset.png)](https://npmjs.org/package/opset)

## Example

```js
const OpSet = require('opset');
const UserModel = require('./models/user.js');
const BlogModel = require('./models/blog.js');
const CommentModel = require('./models/comment.js');

// declare set of interdependent operations
const blog = new OpSet('blog');

blog.set('username', 'edinella'); // already resolved values can be setted

blog.op('user', function() {
  return UserModel.findOne({username: 'edinella'}).exec(); // returns a promise
});

// Async functions are supported too!
blog.op('userPosts', async function(user) {
  let posts = await BlogModel.find({author: user.id}).exec();
  return Promise.all(posts.map(async p => {
    try {
      let comments = await CommentModel.find({post: p._id}).lean().exec();

      if (comments) {
        p.comments = comments;
      }

      return p;
    } catch (e) {
      console.error(e);
    }
  }));
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
const OpSet = require('opset');
```

## API

**OpSet(alias)**: constructor, create a new OpSet with an alias

To produce the instance, `OpSet` should be called with `new` operator.

```js
const report = new OpSet('report');
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
let myStats = report.run('stats');

// handle results
myStats.then(function(result) {
  console.log(result);
});

// handle errors, including those unhandled from inside operations
myStats.fail(function(err) {
  console.error(err);
});
```
