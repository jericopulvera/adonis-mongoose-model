'use strict'

require('../lib/iocResolver').setFold(require('@adonisjs/fold'))
const test = require('japa')
const path = require('path')
const _ = require('lodash')
const fs = require('fs')
const {ioc} = require('@adonisjs/fold')

const Factory = require('../src/Factory')
const ModelFactory = require('../src/Factory/ModelFactory')
const ServiceProvider = require('../providers/MongooseProvider')

let Model = null

test.group('Factory', (group) => {
  group.beforeEach(() => {
    Factory.clear()
    ioc.restore()
  })

  group.before(async () => {
    let Mongoose = use('Mongoose')
    Model = use('MongooseModel')

    ioc.singleton('Adonis/Addons/Mongoose', function() {
      Mongoose.connect(
        'mongodb://localhost:27017/test',
        {useNewUrlParser: true}
      )

      return Mongoose
    })
    ioc.alias('Adonis/Addons/Mongoose', 'Mongoose')
  })

  group.afterEach(async () => {
    try {
      await ioc.use('Mongoose').connection.deleteModel(/.+/)
      await ioc.use('Mongoose').connection.dropCollection('users')
    } catch (err) {
      return
    }
  })

  group.after(async () => {
    await ioc.use('Mongoose').connection.dropDatabase()
    await ioc.use('Mongoose').connection.close()
  })

  test('add a new blueprint', (assert) => {
    const fn = function() {}
    Factory.blueprint('App/Models/User', fn)
    assert.deepEqual(Factory._blueprints, [
      {name: 'App/Models/User', callback: fn}
    ])
  })

  test('get model factory when accessing the blueprint', (assert) => {
    const fn = function() {}
    Factory.blueprint('App/Models/User', fn)
    assert.instanceOf(Factory.model('App/Models/User'), ModelFactory)
  })

  test('return data object from blueprint', async (assert) => {
    const fn = function() {
      return {
        name: 'jerico'
      }
    }
    Factory.blueprint('App/Models/User', fn)
    const val = await Factory.model('App/Models/User')._makeOne(1)
    assert.deepEqual(val, {name: 'jerico'})
  })

  test('evaluate functions in data object', async (assert) => {
    const fn = function() {
      return {
        name: () => 'jerico'
      }
    }
    Factory.blueprint('App/Models/User', fn)
    const val = await Factory.model('App/Models/User')._makeOne(1)
    assert.deepEqual(val, {name: 'jerico'})
  })

  test('evaluate async functions in data object', async (assert) => {
    const fn = function() {
      return {
        name: () => {
          return new Promise((resolve) => {
            resolve('jerico')
          })
        }
      }
    }
    Factory.blueprint('App/Models/User', fn)
    const val = await Factory.model('App/Models/User')._makeOne(1)
    assert.deepEqual(val, {name: 'jerico'})
  })

  test('make a single model instance', async (assert) => {
    Factory.blueprint('App/Models/User', (faker) => {
      return {
        name: 'jerico'
      }
    })

    class User extends Model {
      static get schema() {
        return {
          name: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    const user = await Factory.model('App/Models/User').make()
    assert.instanceOf(user, modelInstance)
    assert.deepEqual(_.omit(user.toObject(), '_id'), {name: 'jerico'})
  })

  test('make an array of model instances', async (assert) => {
    Factory.blueprint('App/Models/User', () => {
      return {
        username: 'jerico'
      }
    })

    class User extends Model {
      static get schema() {
        return {
          username: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    const users = await Factory.model('App/Models/User').makeMany(2)
    assert.lengthOf(users, 2)
    assert.deepEqual(_.omit(users[0].toObject(), '_id'), {username: 'jerico'})
    assert.deepEqual(_.omit(users[1].toObject(), '_id'), {username: 'jerico'})
  })

  test('create model instance', async (assert) => {
    Factory.blueprint('App/Models/User', () => {
      return {
        username: 'jerico'
      }
    })

    class User extends Model {
      static get schema() {
        return {
          username: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    const user = await Factory.model('App/Models/User').create()
    assert.instanceOf(user, modelInstance)
  })

  test('create many model instances', async (assert) => {
    Factory.blueprint('App/Models/User', () => {
      return {
        username: 'jerico'
      }
    })

    class User extends Model {
      static get schema() {
        return {
          username: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    const users = await Factory.model('App/Models/User').createMany(2)
    assert.lengthOf(users, 2)
    users.forEach((user) => {
      assert.instanceOf(user, modelInstance)
    })
  })

  test("throw exception when factory blueprint doesn't have a callback", async (assert) => {
    const fn = () => Factory.blueprint('App/Models/User')
    assert.throw(
      fn,
      'E_INVALID_PARAMETER: Factory.blueprint expects a callback as 2nd parameter'
    )
  })

  test('blueprint should receive faker instance', async (assert) => {
    assert.plan(1)

    class User extends Model {}

    ioc.fake('App/Models/User', () => {
      return User
    })

    Factory.blueprint('App/Models/User', (faker) => {
      assert.isFunction(faker.age)
    })
    await Factory.model('App/Models/User').make()
  })

  test('blueprint should receive index', async (assert) => {
    const indexes = []
    class User extends Model {}

    ioc.fake('App/Models/User', () => {
      return User
    })

    Factory.blueprint('App/Models/User', (faker, index) => {
      indexes.push(index)
    })
    await Factory.model('App/Models/User').makeMany(2)
    assert.deepEqual(indexes, [0, 1])
  })

  test('blueprint should receive extra data', async (assert) => {
    const stack = []
    class User extends Model {}

    ioc.fake('App/Models/User', () => {
      return User
    })

    Factory.blueprint('App/Models/User', (faker, index, data) => {
      stack.push(data)
    })
    await Factory.model('App/Models/User').makeMany(2, {username: 'jerico'})
    assert.deepEqual(stack, [{username: 'jerico'}, {username: 'jerico'}])
  })

  // test('get data object for table', async (assert) => {
  //   Factory.blueprint('users', () => {
  //     return {
  //       username: 'jerico'
  //     }
  //   })

  //   const user = await Factory.get('users').make()
  //   assert.deepEqual(user, { username: 'jerico' })
  // })

  // test('get array of data objects for table', async (assert) => {
  //   Factory.blueprint('users', (faker, i) => {
  //     return {
  //       id: i + 1,
  //       username: 'jerico'
  //     }
  //   })

  //   const user = await Factory.get('users').makeMany(2)
  //   assert.deepEqual(user, [{ username: 'jerico', id: 1 }, { username: 'jerico', id: 2 }])
  // })

  // test('save data to table', async (assert) => {
  //   Factory.blueprint('users', (faker, i) => {
  //     return {
  //       id: i + 1,
  //       username: 'jerico'
  //     }
  //   })

  //   await Factory.get('users').create()
  //   const user = await ioc.use('Database').table('users').first()
  //   assert.equal(user.id, 1)
  //   assert.equal(user.username, 'jerico')
  // })

  // test('define table name at runtime', async (assert) => {
  //   Factory.blueprint('User', (faker, i) => {
  //     return {
  //       id: i + 1,
  //       username: 'jerico'
  //     }
  //   })

  //   await Factory.get('User').table('users').create()
  //   const user = await ioc.use('Database').table('users').first()
  //   assert.equal(user.id, 1)
  //   assert.equal(user.username, 'jerico')
  // })

  // test('define returning value', async (assert) => {
  //   Factory.blueprint('User', (faker, i) => {
  //     return {
  //       id: i + 1,
  //       username: 'jerico'
  //     }
  //   })

  //   const returned = await Factory.get('User').table('users').returning('id').create()
  //   const user = await ioc.use('Database').table('users').first()
  //   assert.deepEqual(returned, [1])
  //   assert.equal(user.id, 1)
  //   assert.equal(user.username, 'jerico')
  // })

  // test('define connection', async (assert) => {
  //   Factory.blueprint('User', (faker, i) => {
  //     return {
  //       id: i + 1,
  //       username: 'jerico'
  //     }
  //   })

  //   await Factory.get('User').table('users').connection('').create()
  //   const user = await ioc.use('Database').table('users').first()
  //   assert.equal(user.id, 1)
  //   assert.equal(user.username, 'jerico')
  // })

  // test('truncate table', async (assert) => {
  //   Factory.blueprint('User', (faker, i) => {
  //     return {
  //       id: i + 1,
  //       username: 'jerico'
  //     }
  //   })

  //   await ioc.use('Database').table('users').insert({ username: 'jerico' })
  //   await Factory.get('User').table('users').reset()
  //   const user = await ioc.use('Database').table('users').first()
  //   assert.isUndefined(user)
  // })

  test('reset table via model factory', async (assert) => {
    Factory.blueprint('App/Models/User', () => {
      return {
        username: 'jerico'
      }
    })

    class User extends Model {
      static get schema() {
        return {
          username: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    await Factory.model('App/Models/User').create()
    await Factory.model('App/Models/User').reset()

    const user = await ioc
      .use('Mongoose')
      .connection.collection('users')
      .findOne()

    assert.isNull(user)
  })

  test('generate username', async (assert) => {
    class User extends Model {
      static get schema() {
        return {
          username: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    Factory.blueprint('App/Models/User', (faker, index, data) => {
      return {
        username: faker.username()
      }
    })

    const user = await Factory.model('App/Models/User').make()
    assert.isDefined(user.username)
  })

  test('generate password', async (assert) => {
    class User extends Model {
      static get schema() {
        return {
          password: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    Factory.blueprint('App/Models/User', (faker, index, data) => {
      return {
        password: faker.password()
      }
    })

    const user = await Factory.model('App/Models/User').make()
    assert.isDefined(user.password)
  })

  test('create many pass custom data', async (assert) => {
    Factory.blueprint('App/Models/User', (faker, i, data) => {
      return {
        username: data[i].username
      }
    })

    class User extends Model {
      static get schema() {
        return {
          username: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    const users = await Factory.model('App/Models/User').createMany(2, [
      {
        username: 'jerico'
      },
      {
        username: 'nikk'
      }
    ])

    assert.lengthOf(users, 2)
    assert.equal(users[0].username, 'jerico')
    assert.equal(users[1].username, 'nikk')
  })

  test('make many pass custom data', async (assert) => {
    Factory.blueprint('App/Models/User', (faker, i, data) => {
      return {
        username: data[i].username
      }
    })

    class User extends Model {
      static get schema() {
        return {
          username: {
            type: String
          }
        }
      }
    }

    const modelInstance = await User.buildModel('App/Models/User')
    ioc.fake('App/Models/User', () => {
      return modelInstance
    })

    const users = await Factory.model('App/Models/User').makeMany(2, [
      {
        username: 'joe'
      },
      {
        username: 'john'
      }
    ])

    assert.lengthOf(users, 2)
    assert.equal(users[0].username, 'joe')
    assert.equal(users[1].username, 'john')
  })

  // test('db factory makeMany pass custom data', async (assert) => {
  //   Factory.blueprint('users', (faker, i, data) => {
  //     return {
  //       username: data[i].username
  //     }
  //   })

  //   const users = await Factory.get('users').makeMany(2, [
  //     {
  //       username: 'jerico'
  //     },
  //     {
  //       username: 'nikk'
  //     }
  //   ])

  //   assert.deepEqual(users, [{username: 'jerico'}, {username: 'nikk'}])
  // })

  // test('db factory createMany pass custom data', async (assert) => {
  //   Factory.blueprint('users', (faker, i, data) => {
  //     return {
  //       username: data[i].username
  //     }
  //   })

  //   await Factory.get('users').createMany(2, [
  //     {
  //       username: 'jerico'
  //     },
  //     {
  //       username: 'nikk'
  //     }
  //   ])

  //   const users = await ioc.use('Database').table('users')
  //   assert.deepEqual(users.map((user) => user.username), ['jerico', 'nikk'])
  // })
})
