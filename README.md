# 极简 SPA 状态机
以极简方式为 SPA 页面提供 Redux 接入，把 Redux 的 `actions/reducers/containers/store` 等环节简化为两个接口 `load` 和 `store`

## Quick Start
###### 用 Controller 把页面和接口实现关联起来
```javascript
import fetch from 'isomorphic-fetch';
import Page1 from '../views/pages/page1';

export default {
    $page: Entry,
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
import * as engine from '@mtfe/state-engine';
import ctrl1 from './controller/ctrl1';
import ctrl2 from './controller/ctrl2';
import ctrl3 from './controller/ctrl3';

const pages = engine.load({
    ctrl1,
    ctrl2,
    ctrl3,
});
```
###### 输出 redux store
```javascript
const store = engine.store();
```
###### 组装应用
```javascript

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
## Conceptions
1. Shape of state
1. Controller

## Interfaces
1. load()
1. store()
1. dispatch()