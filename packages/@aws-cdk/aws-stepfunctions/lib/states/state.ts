import cdk = require('@aws-cdk/cdk');
import { Condition } from '../condition';
import { StateGraph } from '../state-graph';
import { CatchProps, DISCARD, Errors, IChainable, INextable, RetryProps } from '../types';

/**
 * Properties shared by all states
 */
export interface StateProps {
    /**
     * A comment describing this state
     *
     * @default No comment
     */
    readonly comment?: string;

    /**
     * JSONPath expression to select part of the state to be the input to this state.
     *
     * May also be the special value DISCARD, which will cause the effective
     * input to be the empty object {}.
     *
     * @default $
     */
    readonly inputPath?: string;

    /**
     * Parameters pass a collection of key-value pairs, either static values or JSONPath expressions that select from the input.
     *
     * @see
     * https://docs.aws.amazon.com/step-functions/latest/dg/input-output-inputpath-params.html#input-output-parameters
     *
     * @default No parameters
     */
    readonly parameters?: { [name: string]: any };

    /**
     * JSONPath expression to select part of the state to be the output to this state.
     *
     * May also be the special value DISCARD, which will cause the effective
     * output to be the empty object {}.
     *
     * @default $
     */
    readonly outputPath?: string;

    /**
     * JSONPath expression to indicate where to inject the state's output
     *
     * May also be the special value DISCARD, which will cause the state's
     * input to become its output.
     *
     * @default $
     */
    readonly resultPath?: string;
}

/**
 * Base class for all other state classes
 */
export abstract class State extends cdk.Construct implements IChainable {
    /**
     * Add a prefix to the stateId of all States found in a construct tree
     */
    public static prefixStates(root: cdk.IConstruct, prefix: string) {
        const queue = [root];
        while (queue.length > 0) {
            const el = queue.splice(0, 1)[0]!;
            if (isPrefixable(el)) {
                el.addPrefix(prefix);
            }
            queue.push(...el.node.children);
        }
    }

    /**
     * Find the set of end states states reachable through transitions from the given start state
     */
    public static findReachableEndStates(start: State, options: FindStateOptions = {}) {
        const visited = new Set<State>();
        const ret = new Set<State>();
        const queue = [start];
        while (queue.length > 0) {
            const state = queue.splice(0, 1)[0]!;
            if (visited.has(state)) { continue; }
            visited.add(state);

            const outgoing = state.outgoingTransitions(options);

            if (outgoing.length > 0) {
                // We can continue
                queue.push(...outgoing);
            } else {
                // Terminal state
                ret.add(state);
            }
        }
        return Array.from(ret);
    }

    /**
     * Return only the states that allow chaining from an array of states
     */
    public static filterNextables(states: State[]): INextable[] {
        return states.filter(isNextable) as any;
    }

    /**
     * First state of this Chainable
     */
    public readonly startState: State;

    /**
     * Continuable states of this Chainable
     */
    public abstract readonly endStates: INextable[];

    // This class has a superset of most of the features of the other states,
    // and the subclasses decide which part of the features to expose. Most
    // features are shared by a couple of states, and it becomes cumbersome to
    // slice it out across all states. This is not great design, but it is
    // pragmatic!
    protected readonly comment?: string;
    protected readonly inputPath?: string;
    protected readonly parameters?: object;
    protected readonly outputPath?: string;
    protected readonly resultPath?: string;
    protected readonly branches: StateGraph[] = [];
    protected defaultChoice?: State;

    /**
     * @internal
     */
    protected _next?: State;

    private readonly retries: RetryProps[] = [];
    private readonly catches: CatchTransition[] = [];
    private readonly choices: ChoiceTransition[] = [];
    private readonly prefixes: string[] = [];

    /**
     * The graph that this state is part of.
     *
     * Used for guaranteeing consistency between graphs and graph components.
     */
    private containingGraph?: StateGraph;

    /**
     * States with references to this state.
     *
     * Used for finding complete connected graph that a state is part of.
     */
    private readonly incomingStates: State[] = [];

    constructor(scope: cdk.Construct, id: string, props: StateProps) {
        super(scope, id);

        this.startState = this;

        this.comment = props.comment;
        this.inputPath = props.inputPath;
        this.parameters = props.parameters;
        this.outputPath = props.outputPath;
        this.resultPath = props.resultPath;
    }

    public get id() {
        return this.node.id;
    }

    /**
     * Tokenized string that evaluates to the state's ID
     */
    public get stateId(): string {
        return this.prefixes.concat(this.id).join('');
    }

    /**
     * Add a prefix to the stateId of this state
     */
    public addPrefix(x: string) {
        if (x !== '') {
            this.prefixes.splice(0, 0, x);
        }
    }

    /**
     * Register this state as part of the given graph
     *
     * Don't call this. It will be called automatically when you work
     * with states normally.
     */
    public bindToGraph(graph: StateGraph) {
        if (this.containingGraph === graph) { return; }

        if (this.containingGraph) {
            // tslint:disable-next-line:max-line-length
            throw new Error(`Trying to use state '${this.stateId}' in ${graph}, but is already in ${this.containingGraph}. Every state can only be used in one graph.`);
        }

        this.containingGraph = graph;
        this.whenBoundToGraph(graph);

        for (const incoming of this.incomingStates) {
            incoming.bindToGraph(graph);
        }
        for (const outgoing of this.outgoingTransitions({ includeErrorHandlers: true })) {
            outgoing.bindToGraph(graph);
        }
        for (const branch of this.branches) {
            branch.registerSuperGraph(this.containingGraph);
        }
    }

    /**
     * Render the state as JSON
     */
    public abstract toStateJson(): object;

    /**
     * Add a retrier to the retry list of this state
     * @internal
     */
    protected _addRetry(props: RetryProps = {}) {
        this.retries.push({
            ...props,
            errors: props.errors ? props.errors : [Errors.All],
        });
    }

    /**
     * Add an error handler to the catch list of this state
     * @internal
     */
    protected _addCatch(handler: State, props: CatchProps = {}) {
        this.catches.push({
            next: handler,
            props: {
                errors: props.errors ? props.errors : [Errors.All],
                resultPath: props.resultPath
            }
        });
        handler.addIncoming(this);
        if (this.containingGraph) {
            handler.bindToGraph(this.containingGraph);
        }
    }

    /**
     * Make the indicated state the default transition of this state
     */
    protected makeNext(next: State) {
        // Can't be called 'setNext' because of JSII
        if (this._next) {
            throw new Error(`State '${this.id}' already has a next state`);
        }
        this._next = next;
        next.addIncoming(this);
        if (this.containingGraph) {
            next.bindToGraph(this.containingGraph);
        }
    }

    /**
     * Add a choice branch to this state
     */
    protected addChoice(condition: Condition, next: State) {
        this.choices.push({ condition, next });
        next.startState.addIncoming(this);
        if (this.containingGraph) {
            next.startState.bindToGraph(this.containingGraph);
        }
    }

    /**
     * Add a paralle branch to this state
     */
    protected addBranch(branch: StateGraph) {
        this.branches.push(branch);
        if (this.containingGraph) {
            branch.registerSuperGraph(this.containingGraph);
        }
    }

    /**
     * Make the indicated state the default choice transition of this state
     */
    protected makeDefault(def: State) {
        // Can't be called 'setDefault' because of JSII
        if (this.defaultChoice) {
            throw new Error(`Choice '${this.id}' already has a default next state`);
        }
        this.defaultChoice = def;
    }

    /**
     * Render the default next state in ASL JSON format
     */
    protected renderNextEnd(): any {
        if (this._next) {
            return { Next: this._next.stateId };
        } else {
            return { End: true };
        }
    }

    /**
     * Render the choices in ASL JSON format
     */
    protected renderChoices(): any {
        return {
            Choices: renderList(this.choices, renderChoice),
            Default: this.defaultChoice ? this.defaultChoice.stateId : undefined,
        };
    }

    /**
     * Render InputPath/Parameters/OutputPath in ASL JSON format
     */
    protected renderInputOutput(): any {
        return {
            InputPath: renderJsonPath(this.inputPath),
            Parameters: this.parameters,
            OutputPath: renderJsonPath(this.outputPath),
        };
    }

    /**
     * Render parallel branches in ASL JSON format
     */
    protected renderBranches(): any {
        return {
            Branches: this.branches.map(b => b.toGraphJson())
        };
    }

    /**
     * Render error recovery options in ASL JSON format
     */
    protected renderRetryCatch(): any {
        return {
            Retry: renderList(this.retries, renderRetry),
            Catch: renderList(this.catches, renderCatch),
        };
    }

    /**
     * Called whenever this state is bound to a graph
     *
     * Can be overridden by subclasses.
     */
    protected whenBoundToGraph(graph: StateGraph) {
        graph.registerState(this);
    }

    /**
     * Add a state to the incoming list
     */
    private addIncoming(source: State) {
        this.incomingStates.push(source);
    }

    /**
     * Return all states this state can transition to
     */
    private outgoingTransitions(options: FindStateOptions): State[] {
        const ret = new Array<State>();
        if (this._next) { ret.push(this._next); }
        if (this.defaultChoice) { ret.push(this.defaultChoice); }
        for (const c of this.choices) {
            ret.push(c.next);
        }
        if (options.includeErrorHandlers) {
            for (const c of this.catches) {
                ret.push(c.next);
            }
        }
        return ret;
    }
}

/**
 * Options for finding reachable states
 */
export interface FindStateOptions {
    /**
     * Whether or not to follow error-handling transitions
     *
     * @default false
     */
    readonly includeErrorHandlers?: boolean;
}

/**
 * A Choice Transition
 */
interface ChoiceTransition {
    /**
     * State to transition to
     */
    next: State;

    /**
     * Condition for this transition
     */
    condition: Condition;
}

/**
 * Render a choice transition
 */
function renderChoice(c: ChoiceTransition) {
    return {
        ...c.condition.renderCondition(),
        Next: c.next.stateId
    };
}

/**
 * A Catch Transition
 */
interface CatchTransition {
    /**
     * State to transition to
     */
    next: State;

    /**
     * Additional properties for this transition
     */
    props: CatchProps;
}

/**
 * Render a Retry object to ASL
 */
function renderRetry(retry: RetryProps) {
    return {
        ErrorEquals: retry.errors,
        IntervalSeconds: retry.interval && retry.interval.toSeconds(),
        MaxAttempts: retry.maxAttempts,
        BackoffRate: retry.backoffRate
    };
}

/**
 * Render a Catch object to ASL
 */
function renderCatch(c: CatchTransition) {
    return {
        ErrorEquals: c.props.errors,
        ResultPath: renderJsonPath(c.props.resultPath),
        Next: c.next.stateId,
    };
}

/**
 * Render a list or return undefined for an empty list
 */
export function renderList<T>(xs: T[], fn: (x: T) => any): any {
    if (xs.length === 0) { return undefined; }
    return xs.map(fn);
}

/**
 * Render JSON path, respecting the special value DISCARD
 */
export function renderJsonPath(jsonPath?: string): undefined | null | string {
    if (jsonPath === undefined) { return undefined; }
    if (jsonPath === DISCARD) { return null; }

    if (!jsonPath.startsWith('$')) {
        throw new Error(`Expected JSON path to start with '$', got: ${jsonPath}`);
    }
    return jsonPath;
}

/**
 * Interface for structural feature testing (to make TypeScript happy)
 */
interface Prefixable {
    addPrefix(x: string): void;
}

/**
 * Whether an object is a Prefixable
 */
function isPrefixable(x: any): x is Prefixable {
    return typeof(x) === 'object' && x.addPrefix;
}

/**
 * Whether an object is INextable
 */
function isNextable(x: any): x is INextable {
    return typeof(x) === 'object' && x.next;
}

/**
 * State types
 */
export enum StateType {
    PASS = 'Pass',
    TASK = 'Task',
    CHOICE = 'Choice',
    WAIT = 'Wait',
    SUCCEED = 'Succeed',
    FAIL = 'Fail',
    PARALLEL = 'Parallel'
}
