/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-07-07 15:18:09
 * @modify date 2019-07-07 15:18:09
 * @desc [description]
 */

import thunkMiddleware from 'redux-thunk'
import { createStore, applyMiddleware } from 'redux'
import { StateEngineBase } from './engine'

declare global {
    interface Window { __REDUX_DEVTOOLS_EXTENSION__: any; }
}

// Create store
export class StateEngine extends StateEngineBase {
    constructor() {
        super()
    }

    private createStoreInstance(useReduxTool:any, ...middlewares: any[]) {
        if (this.store) return this.store;
        const emptyReducer = (state: any = {}) => state;
        if (useReduxTool) {
            /* eslint-disable no-underscore-dangle */
            this.store = createStore(
                // createStore(reducer, [preloadedState], [enhancer])
                this.reducer || emptyReducer,
                Object.assign(this.initState, window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()),
                applyMiddleware(
                    this.middlewareForBindingActionScope.bind(this),
                    thunkMiddleware,
                    ...middlewares,
                )
            )
            /* eslint-enable */
        } else {
            this.store = createStore(
                // createStore(reducer, [preloadedState], [enhancer])
                this.reducer || emptyReducer,
                this.initState,
                applyMiddleware(
                    this.middlewareForBindingActionScope.bind(this),
                    thunkMiddleware,
                    ...middlewares,
                )
            )
        }
        return this.store;
    }

    getStore(...middlewares: any[])  {
        return this.createStoreInstance(false, ...middlewares);
    }
    getStoreWithTools = (...middlewares: any[]) => {
        return this.createStoreInstance(true, ...middlewares);
    }
}

