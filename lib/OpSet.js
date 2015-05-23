var Q     = require('q');
var util  = require('util');
var debug = require('debug');
var _     = require('lodash');

var FN_ARGS        = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG_SPLIT   = /,/;
var FN_ARG         = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

module.exports = OpSet;
function OpSet(alias, Structure) {
  this.setStructure(Structure);
  this.alias = alias || module.filename;
  this.debug = debug('OpSet:' + this.alias);
}

OpSet.prototype.setStructure = function(StructureToExtend) {
  this.Structure = function Structure() {};
  if (StructureToExtend) {
    this.Structure = function Structure() {
      StructureToExtend.apply(this);
    };
    util.inherits(this.Structure, StructureToExtend);
  }
  this.cache = new this.Structure();
};

OpSet.prototype.getStructure = function() {
  return this.Structure;
};

OpSet.prototype.detectDependencies = function(fn) {
  var dependencies = [];
  var fnText = fn.toString().replace(STRIP_COMMENTS, '');
  var argDecl = fnText.match(FN_ARGS);
  _.forEach(argDecl[1].split(FN_ARG_SPLIT), function(arg) {
    arg.replace(FN_ARG, function(all, underscore, name) {
      dependencies.push(name);
    });
  });
  return dependencies;
};

OpSet.prototype.set = function() { // just an alias
  return this.setCache.apply(this, arguments);
};

OpSet.prototype.setCache = function(alias, value) {
  this.debug('Caching "%s"', alias);
  this.cache[alias] = value;
  return this;
};

OpSet.prototype.getCache = function(alias) {
  this.debug('Resolving "%s" from cache', alias);
  return this.cache && this.cache[alias];
};

OpSet.prototype.getOperation = function(alias) {
  this.debug('Resolving "%s" from structure', alias);
  return this.Structure.prototype[alias];
};

OpSet.prototype.op = function() { // just an alias
  return this.operation.apply(this, arguments);
};

OpSet.prototype.operation = function(alias, fn) {
  this.debug('Defining operation "%s"', alias);
  fn.dependencies = this.detectDependencies(fn);
  this.Structure.prototype[alias] = fn;
  return this;
};

OpSet.prototype.value = function(alias, value) {
  this.debug('Defining value "%s"', alias);
  this.Structure.prototype[alias] = value;
  return this;
};

OpSet.prototype.getFunctionSignature = function(fn) {
  var fnText = fn.toString().replace(STRIP_COMMENTS, '');
  var args = fnText.match(FN_ARGS);
  if (args) {
    return 'function(' + (args[1] || '').replace(/[\s\r\n]+/, ' ') + ')';
  }
  return 'fn';
};

OpSet.prototype.run = function(fn, path) {
  path = path && path.slice() || [this.alias];
  var deferred = Q.defer();
  var isString   = _.isString(fn);
  var isFunction = _.isFunction(fn);
  var alias = isString ? fn : this.getFunctionSignature(fn);
  var isCircular = isString && ~path.indexOf(alias);
  var isCached = isString && this.cache.hasOwnProperty(alias);
  path.push(alias);
  var PATH = path.join(' -> ');
  var reject = function(msg) {
    deferred.reject(new Error(msg));
    return deferred.promise;
  };
  if (isCircular) {
    return reject('Circular dependency found: ' + PATH);
  }
  if (!isString && !isFunction) {
    return reject('Cannot run operation: ' + PATH);
  }
  this.debug('Resolving %s', PATH);
  if (isFunction) {
    fn.dependencies = this.detectDependencies(fn);
  }
  if (isString) {
    if (isCached) {
      deferred.resolve(this.getCache(alias));
      return deferred.promise;
    }
    if (_.isUndefined(this.Structure.prototype[alias])) {
      return reject('No provider found for ' + PATH);
    }
    fn = this.getOperation(alias);
  }
  var runner = this.run.bind(this);
  var dependenciesPromises = fn.dependencies.map(function(dep) {
    return Q.fcall(runner, dep, path);
  });
  var resolvedDependencies = Q.all(dependenciesPromises);
  var result = Q.spread(resolvedDependencies, fn.bind(this.cache));
  this.setCache(alias, result);
  deferred.resolve(result);
  var self = this;
  deferred.promise.then(function() {
    self.debug('"%s" OK', PATH);
  });
  deferred.promise.fail(function(err) {
    self.debug('"%s" ERROR', PATH, err.stack);
  });
  return deferred.promise;
};
