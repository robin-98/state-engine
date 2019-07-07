# State Engine for MVC
Super simplified from redux by converting `actions/reducers/containers/store` to `load` and `store`, so that providing super simple MVC developing model for front-end Apps

## What you will get
A super simple MVC model, all properties of all views are mapped to the space of corresponding controllers, without those redundent and anoying actions or reducers

## Quick Start (React.js)
###### Step 1: Connect controllers with pages 
```javascript
import fetch from 'isomorphic-fetch';
import Page1 from '../views/pages/page1';

export default {
    $page: Page1,
    // $combine: { 
    //     face: 'uiue.face.identifier', 
    //     foot: 'uiue.foot.toes', 
    // },
    querySomething: async (arg1, arg2) => {
        const res = await fetch(`<some address>?arg1=${arg1}&arg2=${arg2}`, {
            method: 'get'
        });
        return await res.json();
    }
    updateShopList: async (arg1, arg2) => {
        const res = await fetch('<some address>', {
            method: 'put',
            body: JSON.stringify({ arg1, arg2 }),
        });
        return await res.json();
    }
}
```
###### Step 2: load controllers
```javascript
import * as engine from 'state-engine';

import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import ctrl1 from './controller/ctrl1';
import ctrl2 from './controller/ctrl2';
import ctrl3 from './controller/ctrl3';

const parameters = {
    connecter: connect,
    withRouter: withRouter,
};

const pages = engine.load({
    ctrl1,
    ctrl2,
    ctrl3,
}, parameters);
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
            <Router history={browserHistory}>
                <Route path="/page1" component={page.ctrl1} />
                <Route path="/page2" component={page.ctrl2} />
                <Route path="/page3" component={page.ctrl3} />
            </Router>
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
## Concepts
1. The structure of store equals with the organization of controllers
1. Pages (collection of views) are loaded to the coresponding node using keyword `$page`
1. The State of current node:
    1. is mapped to props of corresponding page
    1. is updated by the return value of interfaces within the controller: `currentState = Object.assign(currentState, responseOfCtrl)`
1. keyword `$combine`: import states of other pages to current node, there are three different kinds of usages:
    1. `$combine: 'path.to.prop1'` : map `path.to.prop1` to `prop1` of current node
    1. `$combine: [ 'path.to.prop1', 'path.to.prop2 ]` : map one or multiple props (prop1, prop2) to current node
    1. `$combine: { customPropName1: 'path.to.prop1', customPropName2: 'path.to.prop2' }` : map and rename one or multiple props to current node
## Interfaces
1. `load(controllers, params = {path: '', converter: prop => () => prop, connecter: () => page => page, withRouter: page => page })`
    1. `controllers`: an instance composed by all controllers
    1. `path`: the root path, default value is empty
    1. `converter`: a user defined function to convert string properties into functions
    1. `connecter`:  the `connect` function required by `react-redux`
    1. `withRouter`: `withRouter` function required by `react-router`
1. `store(...middlewares)`: configure redux store with user defined middlewares
    1. `middlewares`: `Redux` middlewares
1. `dispatch(actionPath, ...actionParameters)`: manually dispatch a redux action (safe but not suggested)
    1. `actionPath`: path to that interface
    1. `actionParameters`: parameters for that interface


# Safe Coding!
