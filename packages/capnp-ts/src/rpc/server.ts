import { Method } from "./method";
import { Struct } from "../serialization/pointers/struct";
import { Message } from "../serialization/message";
import { DataCall, Call, copyCall } from "./call";
import { Fulfiller } from "./fulfiller/fulfiller";
import { Client } from "./client";
import { Answer } from "./answer";
import { ErrorAnswer } from "./error-answer";
import { MethodError } from "./method-error";
import { RPC_METHOD_NOT_IMPLEMENTED } from "../errors";

export interface ServerMethod<P extends Struct, R extends Struct> extends Method<P, R> {
  impl(params: P, results: R): Promise<void>;
}

export interface ServerCall<P extends Struct, R extends Struct> extends DataCall<P, R> {
  serverMethod: ServerMethod<P, R>;
  answer: Fulfiller<R>;
}

// A server is a locally implemented interface
export class Server implements Client {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: Array<ServerMethod<any, any>>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(target: unknown, methods: Array<ServerMethod<any, any>>) {
    this.target = target;
    this.methods = methods;
  }

  startCall<P extends Struct, R extends Struct>(call: ServerCall<P, R>): void {
    const msg = new Message();
    const results = msg.initRoot(call.method.ResultsClass);
    call.serverMethod.impl
      .call(this.target, call.params, results)
      .then(() => call.answer.fulfill(results))
      .catch((err) => call.answer.reject(err as Error));
  }

  call<P extends Struct, R extends Struct>(call: Call<P, R>): Answer<R> {
    const serverMethod = this.methods[call.method.methodId];
    if (!serverMethod) {
      return new ErrorAnswer(new MethodError(call.method, RPC_METHOD_NOT_IMPLEMENTED));
    }
    const serverCall: ServerCall<P, R> = {
      ...copyCall(call),
      answer: new Fulfiller<R>(),
      serverMethod,
    };
    this.startCall(serverCall);
    return serverCall.answer;
  }

  close(): void {
    // muffin
  }
}
