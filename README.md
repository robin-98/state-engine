# 极简 SPA 状态机
以极简方式为 SPA 页面提供 Redux 接入，把 Redux 的 `actions/reducers/containers/store` 等环节简化为两个接口 `load` 和 `store`

## Quick Start
##### 1. 用 Controller 把页面和接口实现关联起来
```

```
##### 1. 加载 controllers

    1. 

##### 1. 输出 redux store

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