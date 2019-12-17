/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-07-08 17:23:15
 * @modify date 2019-07-08 17:23:15
 * @desc [description]
 */
import { 
    KeyValue, getPropPath, mergeStateToProps, mergeDispatchToProps, combineSubReducers,
    getActionNameByStatus, ActionStatus, createNaiveReducer, getActionStatusByName,
    checkPropertyType, PropertyType, checkActionType, ActionType, ActionScope, ActionPayload
} from './stateSpace'
import co from 'co'
import { combineReducers } from 'redux'

// Interfaces
interface Controller {
    $name?: string  // May be omitted, using its file name instead
    $id?: string    // a global unique id, which can be located directlly
    $view?: any     // View object, in React or something else
    $combine?: string | string[] | {[key: string]: string}
    $children?: Controller[]
    [key: string]: any  // Properties of the state, if type of the value is function, then it is an action
}

interface LoadParameter {
    converter?: any
    connecter?: any
    withRouter?: any
    viewAssembler?: ViewAssembler
}

interface LoadResult {
    name: string|undefined|null
    reducer: any
    states: any
    rootView: any
    views?: KeyValue
}

interface ConnectView { 
    currentPath: string
    connecter: any
    withRouter: any
    combines: any
    actionScope: ActionScope
    view: any 
}

export interface ViewAssembler {
    (view: any, subviews: KeyValue): any
}

export class StateEngineBase {

    protected actionCache: Map<string, {name: string, actionScope: ActionScope, expandedActions: KeyValue}>
    protected namedPathCache: Map<string, string>
    protected viewCache: Map<string, any>
    public initState: KeyValue
    protected reducer: any
    public store: any
    public rootView: any
    public views: KeyValue
    protected actionScopeCache: Map<string, {status: ActionStatus, actionScope: ActionScope}>

    constructor() {
        this.actionCache = new Map<string, {name: string, actionScope: ActionScope, expandedActions: KeyValue}>()
        this.actionScopeCache = new Map<string, {status: ActionStatus, actionScope: ActionScope}>()
        this.namedPathCache = new Map<string, string>()
        this.viewCache = new Map<string,any>()
        this.views = {}
        this.reducer = null
        this.initState = {}
        this.store = null
        this.rootView = null
    }

    // internal action will update entire current state space with its response object
    protected isInternalAction(actionName: string): boolean {
        if (!actionName) return false
        if (actionName[0] === '_') return true
        else return false
    }

    protected cacheActions(currentPath: string, actionScope: ActionScope, expandedActions: KeyValue) {
        for (let actionName in expandedActions) {
            const actionPath = getPropPath(currentPath, actionName)
            this.actionCache.set(actionPath, {name: actionName, actionScope, expandedActions})
            let status = getActionStatusByName(actionName)
            if (status) {
                this.actionScopeCache.set(actionPath, {status, actionScope})
            }
        }
    }

    protected middlewareForBindingActionScope(store: any) {
        return (next: any) => (action: ActionPayload) => {
            if (!action || !action.type || !this.actionScopeCache.has(action.type)) {
                return next(action)
            }
            const {actionScope} = this.actionScopeCache.get(action.type)!
            const bindState = () => {
                const state = store.getState()
                let node = state
                for (let seg of actionScope.segmentsCache) {
                    node = node[seg] || {}
                }
                actionScope.bind(node)
            }
            bindState()
            next(action)
            bindState()
        }
    }

    protected getActionByPath(path: string, original: boolean = false) {
        const cache = this.actionCache.get(path)
        if (!cache) return null
        else if (cache.actionScope.hasAction(cache.name)) {
            return {action: cache.actionScope.getAction(cache.name, original), that: cache.actionScope.bindCache}
        } else {
            return {action: cache.expandedActions[cache.name], that: cache.actionScope.bindCache}
        }
    }

    protected expandActions(currentPath: string, actions: KeyValue) {
        // This will expand each action to at least 4 more actions
        // which to indicate the action is in which status
        // 1. when begin to execute an action, an affiliated action 'doing' should be triggerred at first
        //    this will update current state space with a property '<action name>.status' and its value is 'doing'
        // 2. then the true action handler would be executed and waited until it respond or crash with error
        // 3. if the action executed successfully, another affilated action 'done' should be triggered together with its response object
        //    the response object will be used to update current state space,
        //    if the action is an internal action (whose name begin with character: _ ), the entire current state space will be updated by its response object
        //    otherwise an affiliated property `<action name>.response` of current space will be updated with its response object
        //    meanwhile the property `<action name>.status` of current state space will be updated with value 'done'
        // 4. if the action crashed with an error, an affilated action 'error' would be triggerred with the error object
        //    and the property `<action name>.status` of current state space will be updated with value 'error'
        //    and another affilated property `<action name>.error` of current state space will be updated with the error object
        // 5. after all proper handlings, including `done` and `error`, the final action 'idle' is strongly suggested to be triggerred
        //    for the goodness of future uses of this action
        //    and the status of the action `<action name>.status` should be 'idle' when the action has lost the focus

        const actionNames = Object.keys(actions)
        for (let actionName of actionNames) {
            for (let status of Object.keys(ActionStatus)) {
                const statusActionName = getActionNameByStatus(actionName, status)
                const statusActionPath = getPropPath(currentPath, statusActionName)
                actions[statusActionName] = (payload?: any) => {
                    let data: KeyValue = {}
                    data[`${actionName}$status`] = ActionStatus[status as keyof typeof ActionStatus]
                    if (status === ActionStatus.error) {
                        data[`${actionName}$error`] = payload 
                    // } else if (status === ActionStatus.done && this.isInternalAction(actionName) && payload && typeof payload === 'object') {
                    //     data = Object.assign({}, data, payload)
                    } else if (status === ActionStatus.done) {
                        data[`${actionName}$response`] = payload
                        if (payload && typeof payload === 'object') {
                            data = Object.assign({}, data, payload)
                        }
                    }
                    
                    const action = { type: statusActionPath, data }
                    return action
                }
            }
        }
    }

    protected connectView ({ currentPath, connecter, withRouter, combines, actionScope, view }: ConnectView) {
        // using the interface of default connect function of redux
        const connectedView = connecter(
            mergeStateToProps(currentPath, combines, actionScope, this.namedPathCache),
            mergeDispatchToProps(this.dispatch.bind(this), currentPath, actionScope)
            /* mergeProps,  options */
        )(view)

        return withRouter(connectedView)
    }

    getView(path: string) {
        return this.viewCache.get(path)
    }

    // Load the controllers, which should be already assembled as a single controller object
    // {
    //     $name: <controller name, is optional, filename will be used when omitted>,
    //     $view: <React view object> ,
    //     $combine:   <global path to some property> 
    //                     | [ <path1>, <path2>...]
    //                     | { prop1: path1, prop2: path2 ... }
    //     [property: string]: <value of the property used as init state>
    //     [action name: string]: <function body as the action handler>
    //     $children: [ <sub-controller1>, <sub-controller2> ... ]
    // }
    load (controller: Controller, params: LoadParameter, parentPath: string = '', isRoot: boolean = true): LoadResult|null {
        const { converter, connecter, withRouter , viewAssembler} = Object.assign( {
            converter: (prop: any) => prop, connecter: () => (currentView: any) => currentView,
            withRouter: (args: any) => args, viewAssembler: (currentView: any , subviews: KeyValue) => (subviews)?currentView:currentView
        }, params)

        const { $name, $id, $view, $combine, $children, ...others } = controller

        let currentPath = parentPath
        if ($name) {
            currentPath = getPropPath(parentPath, $name)
            if ($id) this.namedPathCache.set(`#${$id}`, currentPath)
        }

        // load current states
        let states:KeyValue = {}, actions:KeyValue = {}
        for (const prop in others) {
            const value = converter(others[prop])
            const propType = checkPropertyType(prop, value)
            if (propType === PropertyType.action) {
                actions[prop] = value
            } else if (propType === PropertyType.property) {
                states[prop] = value
            }
        }
        
        // load children states and reducers
        // combine current reducer with its children reducers
        let subReducers: KeyValue = {}, subviews: KeyValue = {}
        let neighborReducers: any[] = []
        if ($children && Array.isArray($children) && $children.length > 0) {
            const subStates: KeyValue = {}
            for (let child of $children) {
                let res = this.load(child, params, currentPath, false)
                if (!res) continue
                if (!res.name) {
                    neighborReducers.push(res.reducer)
                    // states = Object.assign({}, states, res.states)
                    states = Object.assign(states, res.states)
                    subviews = Object.assign(subviews, res.views)
                } else {
                    subReducers[res.name] = res.reducer
                    subStates[res.name] = res.states
                    subviews[res.name] = res.rootView
                }
            }
            // states = Object.assign({}, states, subStates)
            states = Object.assign(states, subStates)
        }

        
        // Connect view using original actions
        let currentView = viewAssembler($view, subviews)
        const actionScope = new ActionScope(currentPath, actions)
        if ($name && currentView) {
            this.viewCache.set(currentPath, currentView)
            currentView = this.connectView({
                currentPath, connecter, withRouter,
                combines: $combine, 
                actionScope,
                view: currentView 
            })
        }
        // expand actions
        this.expandActions(currentPath, actions)
        this.cacheActions(currentPath, actionScope, actions)

        const currentReducer = (Object.keys(actions).length > 0)
                        ? createNaiveReducer(currentPath, Object.keys(actions), states)
                        : (stateInst: any = states) => stateInst
        const reducer = combineSubReducers([currentReducer, ...neighborReducers], subReducers)

        // save root reducer
        if (isRoot) {
            if (!$name) this.reducer = reducer
            else {
                const reducerObj: KeyValue = {}
                reducerObj[$name] = reducer
                this.reducer = combineReducers(reducerObj)
            }
            // if (!$name) this.initState = Object.assign({}, states)
            // else this.initState[$name] = Object.assign({}, states)
            if (!$name) this.initState = states
            else this.initState[$name] = states
            if (currentView) this.rootView = currentView
            if (!$name) this.views = subviews
        }
        // return result of current node
        return { name: $name, reducer, states, rootView: currentView, views: subviews }
    }

    dispatch(actionPath: string, ...params: any[]): Promise<any>|any {
        if (!this.store || !this.store.dispatch) {
            throw `controllers must be loaded before dispatching actions`
        }
        if (typeof actionPath !== 'string') {
            return this.store.dispatch({type: 'error', data: 'action path should be a string'})
        }
        if (!this.actionCache.has(actionPath)) {
            return this.store.dispatch({type: 'error', data: 'action does not exist'})
        }
            
        const dispatchByStatus = (status: ActionStatus, payload?: any) => {
            const { action } = this.getActionByPath(getActionNameByStatus(actionPath, status)) || { action: ()=>({type: 'error', data: {message: `unknown action '${actionPath}' with status '${status}'`}})}
            switch (status) {
            case ActionStatus.doing: case ActionStatus.idle:
                this.store.dispatch(action())
                break
            case ActionStatus.done: case ActionStatus.error:
                this.store.dispatch(action(payload))
                break
            default:
                break
            }
        }
        // Dispatch the action of 'doing', not the action itself,
        // here is just to indicate the action is going to be in 'doing' status
        // not the actual execution of the action
        dispatchByStatus(ActionStatus.doing)

        // Execute the true action, according to its tpye: async, generator, promise, or pure function
        const {action, that} = this.getActionByPath(actionPath, true) || {action: null, that: null}
        const actionType = checkActionType(action)
        let promiseObj = null, res = null, err = null, isDone = false, isError = false
        Object.keys(ActionType).forEach((k:string) => {
            if (ActionType[k as keyof typeof ActionType] === actionType) {
                console.log('action type:', k)
            }
        })
        switch (actionType) {
        case ActionType.asyncFunction: case ActionType.asyncArrowFunction:
            promiseObj = action.apply(that, params)
            break
        case ActionType.generator:
            promiseObj = co(action.apply(that, params))
            break
        case ActionType.promise:
            promiseObj = action
            break
        case ActionType.syncFunction: case ActionType.syncArrowFunction:
            try {
                res = action.apply(that, params)
                if (checkActionType(res) === ActionType.promise) {
                    promiseObj = res
                } else {
                    isDone = true
                }
            } catch (e) {
                isError = true
                err = e
            }
            break
        default:
            throw `unsupported action: ${action}, at path'${actionPath}'`
        }

        if (isDone || isError) {
            // sync actions remain sync
            if (isError) {
                dispatchByStatus(ActionStatus.error, err)
                throw err
            } else {
                dispatchByStatus(ActionStatus.done, res)
                return res
            }
        } else if (promiseObj) {
            console.log('is promise obj:', promiseObj)
            return promiseObj.then((res: any) => {
                // to indicate the action is done, with the response = res
                dispatchByStatus(ActionStatus.done, res)
                return res;
            }).catch((e: any) => {
                // to indicate the action is broken with error
                dispatchByStatus(ActionStatus.error, e)
                throw e;
            });
        } else {
            const errMsg = `unsupported action handler type: ${actionType}, path: ${actionPath}`
            this.store.dispatch({ type: 'error', data: errMsg })
            throw errMsg
        }
    }

}

