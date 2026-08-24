# Cold/warm semantics

A request is marked cold only when it is the first request handled by the current Node process. Subsequent requests in the same process are marked warm. This measures application-process cold starts directly rather than inferring them from duration.
