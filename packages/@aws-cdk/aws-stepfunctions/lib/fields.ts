import { Token } from "@aws-cdk/cdk";
import { findReferencedPaths, JsonPathToken, renderObject } from "./json-path";

/**
 * Extract a field from the State Machine data that gets passed around between states
 */
export class Data {
  /**
   * Instead of using a literal string, get the value from a JSON path
   */
  public static stringAt(path: string): string {
    validateDataPath(path);
    return new JsonPathToken(path).toString();
  }

  /**
   * Instead of using a literal string list, get the value from a JSON path
   */
  public static listAt(path: string): string[] {
    validateDataPath(path);
    return Token.asList(new JsonPathToken(path));
  }

  /**
   * Instead of using a literal number, get the value from a JSON path
   */
  public static numberAt(path: string): number {
    validateDataPath(path);
    return Token.asNumber(new JsonPathToken(path));
  }

  /**
   * Use the entire data structure
   *
   * Will be an object at invocation time, but is represented in the CDK
   * application as a string.
   */
  public static get entirePayload(): string {
    return new JsonPathToken('$').toString();
  }

  private constructor() {
  }
}

/**
 * Extract a field from the State Machine Context data
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html#wait-token-contextobject
 */
export class Context {
  /**
   * Instead of using a literal string, get the value from a JSON path
   */
  public static stringAt(path: string): string {
    validateContextPath(path);
    return new JsonPathToken(path).toString();
  }

  /**
   * Instead of using a literal number, get the value from a JSON path
   */
  public static numberAt(path: string): number {
    validateContextPath(path);
    return Token.asNumber(new JsonPathToken(path));
  }

  /**
   * Return the Task Token field
   *
   * External actions will need this token to report step completion
   * back to StepFunctions using the `SendTaskSuccess` or `SendTaskFailure`
   * calls.
   */
  public static get taskToken(): string {
    return new JsonPathToken('$$.Task.Token').toString();
  }

  /**
   * Use the entire context data structure
   *
   * Will be an object at invocation time, but is represented in the CDK
   * application as a string.
   */
  public static get entireContext(): string {
    return new JsonPathToken('$$').toString();
  }

  private constructor() {
  }
}

/**
 * Helper functions to work with structures containing fields
 */
export class FieldUtils {

  /**
   * Render a JSON structure containing fields to the right StepFunctions structure
   */
  public static renderObject(obj?: {[key: string]: any}): {[key: string]: any}  | undefined {
    return renderObject(obj);
  }

  /**
   * Return all JSON paths used in the given structure
   */
  public static findReferencedPaths(obj?: {[key: string]: any}): string[] {
    return Array.from(findReferencedPaths(obj)).sort();
  }

  /**
   * Returns whether the given task structure contains the TaskToken field anywhere
   *
   * The field is considered included if the field itself or one of its containing
   * fields occurs anywhere in the payload.
   */
  public static containsTaskToken(obj?: {[key: string]: any}): boolean {
    const paths = findReferencedPaths(obj);
    return paths.has('$$.Task.Token') || paths.has('$$.Task') || paths.has('$$');
  }

  private constructor() {
  }
}

function validateDataPath(path: string) {
  if (!path.startsWith('$.')) {
    throw new Error("Data JSON path values must start with '$.'");
  }
}

function validateContextPath(path: string) {
  if (!path.startsWith('$$.')) {
    throw new Error("Context JSON path values must start with '$$.'");
  }
}