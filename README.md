# State Engine for MVC (Typescript Compatible)
Super intuitive, simplified from redux by converting `actions/reducers/containers/store` to `load` and `store`, so that providing super simple MVC developing model for front-end Apps

## What you will get
A super simple MVC model, all properties of all views are mapped to the space of corresponding controllers, without those redundent and anoying actions or reducers

## Quick Start (React.js)
###### Step 1: Connect controllers with pages 
```javascript
// ./controllers/rootCtrl.ts
import fetch from 'isomorphic-fetch';
import RootView from '../views/RootView';

export default {
    $view: RootView,
    $id: 'unique_id_for_view1'
    $combine: { 
        face: 'uiue.face.identifier', 
        foot: 'uiue.foot.toes', 
        boot: '#unique_id_for_boot_view'
    },
    someInitState1: 'value of that state',
    someOtherInitState2: 1234567890,
    someDateTypeState3: new Date(),
    someStateForCounting: 0,
    onCountingButtonPress: function() {
        return { someStateForCounting: this.someStateForCounting + 1 }
    },
    querySomething: async (arg1, arg2) => {
        const res = await fetch(`<some address>?arg1=${arg1}&arg2=${arg2}`, {
            method: 'get'
        });
        return await res.json();
    },
    $children: [ subCtrl1, subCtrl2, subCtrl3 ]
}
```
###### Step 2: load controllers
```javascript
import * as engine from 'state-engine';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import controller from './controllers/rootCtrl';

const parameters = {
    connecter: connect,
    withRouter: withRouter,
    viewAssembler: (View: any, subviews: {[key: string]: any}) => {
        const subviewArray = Object.keys(subviews).map((viewName) => subviews[viewName])
        return ( <View> { subviewArray.map((SubView, i) => (<SubView key={i}></SubView>)) } </View> )
    }
};

engine.load(controller, parameters);
```
###### Step 3: generate the redux store
```javascript
import { createLogger } from 'redux-logger';
const loggerMiddleware = createLogger();
const store = engine.store(loggerMiddleware);
```
###### Final Step: assemble the application
```javascript
import React, { Component }  from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux'
import { Router, Route, IndexRoute, Link, Switch } from 'react-router-dom'
import createBrowserHistory from 'history/createBrowserHistory'

const browserHistory = createBrowserHistory();

if (document.getElementById('root')) {
    ReactDOM.render(
        <Provider store = {store} >
            <engine.view />
        </Provider>
        , document.getElementById('root')
    );
}
```
###### Manually dispatching actions (not suggested)
```javascript
engine.dispatch('path.to.some.action', arg1, arg2, arg3);
```
## Suggested Project Structure
```
|-controllers
|  |-ctrl1
|  |-ctrl2
|  |-index.js
|-views
|  |-component
|  |-pages
|-engine.js
|-router.js
|-app.js
```

## Controller data structure:
```shell
{
    $name: <controller name, is optional, filename will be used when omitted>,
    $id: <global unique identity, allowing accessing this ctrl without providing full path>,
    $view: <React view object> ,
    $combine:   <global path to some property> 
                    | [ <path1>, <path2>...]
                    | { prop1: path1, prop2: path2 ... }
    [property: string]: <value of the property used as init state>
    [action name: string]: <function body as the action handler>
    $children: [ <sub-controller1>, <sub-controller2> ... ]
}
```

## Concepts

1. `$name` can not be omitted, and must be unique throughout its layer
1. The structure of store equals with the organization of controllers
1. View (collection of views) is loaded to the coresponding node using keyword `$view`
1. The State of current node:
    1. is mapped to props of corresponding page
    1. is updated by the return value of interfaces within the controller: `currentState = Object.assign(currentState, responseOfCtrl)`, unless the response value is not an object, then it will be assigned to a property: `<action name>.response`
1. keyword `$combine`: import states of other pages to current node, there are three different kinds of usages:
    1. `$combine: 'path.to.prop1'` : map `path.to.prop1` to `prop1` of current node
    1. `$combine: [ 'path.to.prop1', 'path.to.prop2 ]` : map one or multiple props (prop1, prop2) to current node
    1. `$combine: { customPropName1: 'path.to.prop1', customPropName2: 'path.to.prop2' }` : map and rename one or multiple props to current node
1. `$id` is optional. Can be used to locate a path like `$combine: { someCustomProp: '#someId' }`

## Action Scope

Every action defined by keyword `function` or `async function` is guaranteed to have dynamic runtime action scope connected with the controller `state` and other actions

as the example above has shown:
```javascript
{
    $name: ...,
    $view: ...,
    someStateForCounting: 0,
    log: (someMsg) => {
        console.log(someMsg)
    },
    onCountingButtonPress: function() {
        this.log(`counting value is going to change to: ${this.someStateForCounting+1}`)
        return { someStateForCounting: this.someStateForCounting + 1 }
    }
}
```
the action `onCountingButtonPress` can access the property `someStateForCounting` of the controller, and the value is guaranteed to be up-to-date, and can see all other actions by using the scope pointer `this`

And by returning an object containing the same property with new value, the corresponding property is updated.

**CAUTION** As the state is updated in a One-Way-Flow (which means what is read can not be writen), so the only way to update any state is to return a new object containning the desired properties.

**CAUTION AGAIN** Arrow functions do not hold its own scope, so `Action Scope` is not available for arrow functions. ***DO NOT ACCESS STATE IN ARROW FUNCTIONS***

## Action Expanding

Every action will be expanded to at least 4 more actions
which to indicate the action is in which status

1. when begin to execute an action, an affiliated action 'doing' should be triggerred at first this will update current state space with a property `<action name>.status` and its value is 'doing'
1. then the true action handler would be executed and waited until it respond or crash with error
1. if the action executed successfully, another affilated action 'done' should be triggered together with its response object
    1. the response object will be used to update current state space,
    1. if the action is an internal action (whose name begin with character: _ ), the entire current state space will be updated by its response object
    1. otherwise an affiliated property `<action name>.response` of current space will be updated with its response object
    1. meanwhile the property `<action name>.status` of current state space will be updated with value 'done'
4. if the action crashed with an error, an affilated action 'error' would be triggerred with the error object
    1. and the property `<action name>.status` of current state space will be updated with value 'error'
    1. and another affilated property `<action name>.error` of current state space will be updated with the error object
5. after all proper handlings, including `done` and `error`, the final action 'idle' is strongly suggested to be triggerred
    1. for the goodness of future uses of this action
    1. and the status of the action `<action name>.status` should be 'idle' when the action has lost the focus
    1. to set action in idle status, just invoke `this.props.<action name>.idle()` in the view, or `this.<action name>.idle()` in the controller

## Interfaces
1. `load(controller,  params = { converter: prop => () => prop, connecter: () => page => page, withRouter: page => page, viewAssembler: (currentView:any, subviews: {[key: string]: any}) => currentView }, parentPath: string = '')`
    1. `controller`: as the parameter name means
    1. `parentPath`: the parent path, default value is empty
    1. `converter`: a user defined function to convert string properties into functions
    1. `connecter`:  the `connect` function required by `react-redux`
    1. `withRouter`: `withRouter` function required by `react-router`
    1. `viewAssembler`: a callback handler to assemble subviews for each view in the controller
1. `store(...middlewares)`: configure redux store with user defined middlewares
    1. `middlewares`: `Redux` middlewares
1. `dispatch(actionPath, ...actionParameters)`: manually dispatch a redux action (safe but not suggested)
    1. `actionPath`: path to that interface
    1. `actionParameters`: parameters for that interface


# Enjoy the flying state!
