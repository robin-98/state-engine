/**
 * @author Robin Sun
 * @email robin@naturewake.com
 * @create date 2019-07-08 17:23:15
 * @modify date 2019-07-08 17:23:15
 * @desc [description]
 */
import { combineReducers } from 'redux'
import { 
    KeyValue, getPropPath, mergeStateToProps, mergeDispatchToProps, combineSubReducers,
    getActionNameByStatus, ActionStatus, createNaiveReducer,
    checkPropertyType, PropertyType, checkActionType, ActionType
} from './stateSpace'
import co from 'co'

// Interfaces
interface Controller {
    $name: string  // May be omitted, using its file name instead
    $id?: string    // a global unique id, which can be located directlly
    $view: any     // View object, in React or something else
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
    name: string
    reducer: any
    states: any
    view: any
}

interface ConnectView { 
    currentPath: string
    connecter: any
    withRouter: any
    combines: any
    originalActions: any
    view: any 
}

export interface ViewAssembler {
    (view: any, subviews: KeyValue): any
}

export class StateEngineBase {

    protected actionCache: Map<string, any>
    protected pathCache: Map<string, string>
    public reducer: any
    public initState: KeyValue
    public store: any
    public view: any

    constructor() {
        this.actionCache = new Map<string, any>()
        this.pathCache = new Map<string, string>()
        this.reducer = null
        this.initState = {}
        this.store = null
        this.view = null
    }

    // internal action will update entire current state space with its response object
    protected isInternalAction(actionName: string): boolean {
        if (!actionName) return false
        if (actionName[0] === '_') return true
        else return false
    }

    protected cacheActions(currentPath: string, actions: KeyValue) {
        for (let actionName in actions) {
            const actionPath = getPropPath(currentPath, actionName)
            this.actionCache.set(actionPath, actions[actionName])
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
                    data[`${actionName}.status`] = ActionStatus[status as keyof typeof ActionStatus]
                    if (status === ActionStatus.error) {
                        data[`${actionName}.error`] = payload 
                    } else if (status === ActionStatus.done && this.isInternalAction(actionName) && payload && typeof payload === 'object') {
                        data = Object.assign({}, payload)
                    } else if (status === ActionStatus.done) {
                        data[`${actionName}.response`] = payload
                    }
                    return { type: statusActionPath, data }
                }
            }
        }
    }

    protected connectView ({ currentPath, connecter, withRouter, combines, originalActions, view }: ConnectView) {
        // using the interface of default connect function of redux
        const connectedView = connecter(
            mergeStateToProps(currentPath, combines),
            mergeDispatchToProps(this.dispatch.bind(this), currentPath, originalActions)
            /* mergeProps,  options */
        )(view)
        return withRouter(connectedView)
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
    load (controller: Controller, params: LoadParameter, parentPath: string = ''): LoadResult|null {
        const { converter, connecter, withRouter , viewAssembler} = Object.assign( {
            converter: (prop: any) => prop, connecter: () => (currentView: any) => currentView,
            withRouter: (args: any) => args, viewAssembler: (currentView: any) => currentView
        }, params)

        const { $name, $id, $view, $combine, $children, ...others } = controller
        if (!$name) return null
        const currentPath = getPropPath(parentPath, $name)
        if ($id) this.pathCache.set($id, currentPath)

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
        const subReducers: KeyValue = {}, subviews: KeyValue = {}
        if ($children && Array.isArray($children) && $children.length > 0) {
            const subStates: KeyValue = {}
            for (let child of $children) {
                let res = this.load(child, params, currentPath)
                if (!res || !res.name) continue
                subReducers[res.name] = res.reducer
                subStates[res.name] = res.states
                subviews[res.name] = res.view
            }
            states = Object.assign(states, subStates)
        }

        // Connect view using original actions
        let currentView = this.connectView({
            currentPath, connecter, withRouter,
            combines: $combine, 
            originalActions: actions,
            view: (Object.keys(subviews).length > 0)? viewAssembler($view, subviews) : $view
        })

        // expand actions
        this.expandActions(currentPath, actions)
        this.cacheActions(currentPath, actions)

        const currentReducer = (Object.keys(actions).length > 0)
                        ? createNaiveReducer(Object.keys(actions), states)
                        : (stateInst: any = states) => stateInst
        const reducer = combineSubReducers(currentReducer, subReducers)

        // save root reducer
        if (parentPath === '') {
            const rootReducerObj: KeyValue = {}
            rootReducerObj[$name] = reducer
            this.reducer = combineReducers(rootReducerObj)
            this.initState[$name] = states
            this.view = currentView
        }
        // return result of current node
        return { name: $name, reducer, states, view: currentView }
    }

    dispatch(actionPath: string, ...params: any[]): Promise<any>|any {
        if (!this.store || !this.store.diapatch) {
            throw `controllers must be loaded before dispatching actions`
        }
        if (typeof actionPath !== 'string') {
            return this.store.diapatch({type: 'error', data: 'action path should be a string'})
        }
        if (!this.actionCache.has(actionPath)) {
            return this.store.diapatch({type: 'error', data: 'action does not exist'})
        }
            
        const dispatchByStatus = (status: ActionStatus, payload?: any) => {
            switch (status) {
            case ActionStatus.doing: case ActionStatus.idle:
                this.store.diapatch(this.actionCache.get(getActionNameByStatus(actionPath, status))())
                break
            case ActionStatus.done: case ActionStatus.error:
                this.store.diapatch(this.actionCache.get(getActionNameByStatus(actionPath, status))(payload))
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
        const action = this.actionCache.get(actionPath)
        const actionType = checkActionType(action)
        let promiseObj = null, res = null, err = null, isDone = false, isError = false
        switch (actionType) {
        case ActionType.async:
            promiseObj = action(...params)
            break
        case ActionType.generator:
            promiseObj = co(action(...params))
            break
        case ActionType.promise:
            promiseObj = action
            break
        case ActionType.sync:
            try {
                res = action(...params)
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
            break
        }

        if (isDone || isError) {
            // sync actions remain sync
            if (isError) {
                dispatchByStatus(ActionStatus.error, err)
                throw err
            } else {
                dispatchByStatus(ActionStatus.done, res)
            }
        } else if (promiseObj) {
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
            this.store.diapatch({ type: 'error', data: errMsg })
            throw errMsg
        }
    }

}

