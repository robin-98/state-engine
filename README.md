# 极简 SPA 状态机
以极简方式为 SPA 页面提供 Redux 接入，把 Redux 的 `actions/reducers/containers/store` 等环节简化为两个接口 `load` 和 `store`

## Quick Start (React.js)
###### 用 Controller 把页面和接口实现关联起来
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
###### 加载 controllers
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
###### 输出 redux store
```javascript
import { createLogger } from 'redux-logger';
const loggerMiddleware = createLogger();
const store = engine.store(loggerMiddleware);
```
###### 组装应用
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
###### 触发指定 Action (调用某接口)
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
1. State 的结构对等于 controller 的组织结构
1. 页面通过 `$page` 挂载到相应的节点
1. 当前节点的 State
    1. 对应于页面的 props
    1. controllers 中定义的接口的返回值会更新当前节点的 State: `currentState = Object.assign(currentState, responseOfCtrl)`
1. 从当前页面获取其他路径的 state: 在 controller 中，用 `$combine` 定义需要获取的其他路径，有以下三种方式
    1. `$combine: 'path.to.prop1'` : 在当前页面的 props 中通过 `prop1` 访问 `path.to.prop1`
    1. `$combine: [ 'path.to.prop1', 'path.to.prop2 ]` : 在当前页面的 props 中分别通过 `prop1` 和 `prop2` 访问相应的 state 节点
    1. `$combine: { customPropName1: 'path.to.prop1', customPropName2: 'path.to.prop2' }` : 通过 `customPropName1` 和 `customPropName2` 访问相应的 state 节点
## Interfaces
1. `load(controllers, params = {path: '', converter: prop => () => prop, connecter: () => page => page, withRouter: page => page })`
    1. `controllers`: 由各 controller 组成的对象
    1. `path`: 根路径，默认为空
    1. `converter`: 一个函数，当 controller 中的某个属性被定义为**非**函数或对象，比如字符串，`load` 会用 `converter` 函数把该属性转化成可执行函数
    1. `connecter`: 对应于 `react-redux` 中的 `connect`
    1. `withRouter`: 对应于 `react-router` 中的 `withRouter`
1. `store(...middlewares)`
    1. `middlewares`: store 接受 `Redux` 中间件作为参数进行配置，多个中间件以多参数形式排列，顺序加载
1. `dispatch(actionPath, ...actionParameters)`
    1. `actionPath`: 从根节点到该接口的路径
    1. `actionParameters`: 该接口接收的参数


# Safe Coding!