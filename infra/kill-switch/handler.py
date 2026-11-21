"""Cost guardrail: stops the API when a CloudWatch alarm says traffic is abnormal.

The alarm on the API's invocation count calls this function directly. Setting
the API's reserved concurrency to 0 makes Lambda reject every request to it
(callers get 429 Too Many Requests), and rejected requests aren't billed.

It stays off until someone turns it back on deliberately:

    aws lambda delete-function-concurrency --function-name finance-monitor-api

Deploying the stack again does NOT undo it, because the template never sets
reserved concurrency on the API function.
"""

import json
import os

_lambda = None


def _client():
    # Created lazily so tests can run without AWS credentials or a region.
    global _lambda
    if _lambda is None:
        import boto3  # provided by the Lambda runtime

        _lambda = boto3.client("lambda")
    return _lambda


def handler(event, context, client=None):
    target = os.environ["TARGET_FUNCTION"]
    alarm = event.get("alarmData", {})
    state = alarm.get("state", {}).get("value")

    # Alarms only invoke actions on entering ALARM, but check anyway so a
    # manual or mistaken invocation can't take the API down.
    if state != "ALARM":
        print(json.dumps({"action": "none", "reason": f"alarm state is {state!r}"}))
        return {"throttled": False}

    (client or _client()).put_function_concurrency(
        FunctionName=target, ReservedConcurrentExecutions=0
    )
    print(json.dumps({
        "action": "throttled",
        "function": target,
        "alarm": alarm.get("alarmName"),
        "reason": alarm.get("state", {}).get("reason"),
        "restore": f"aws lambda delete-function-concurrency --function-name {target}",
    }))
    return {"throttled": True, "function": target}
