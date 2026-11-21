"""Tests for the cost guardrail's shut-off function.

Run from the repo root:  python3 -m unittest discover -s infra/tests
"""

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "kill-switch"))
import handler  # noqa: E402


def alarm_event(state):
    # The shape CloudWatch sends when an alarm invokes a Lambda function directly.
    return {
        "source": "aws.cloudwatch",
        "alarmArn": "arn:aws:cloudwatch:ap-southeast-2:123456789012:alarm:finance-monitor-api-traffic-spike",
        "alarmData": {
            "alarmName": "finance-monitor-api-traffic-spike",
            "state": {"value": state, "reason": "Threshold Crossed"},
            "previousState": {"value": "OK"},
        },
    }


@mock.patch.dict(os.environ, {"TARGET_FUNCTION": "finance-monitor-api"})
class ShutOffTests(unittest.TestCase):
    def test_alarm_sets_the_api_concurrency_to_zero(self):
        client = mock.Mock()

        result = handler.handler(alarm_event("ALARM"), None, client=client)

        client.put_function_concurrency.assert_called_once_with(
            FunctionName="finance-monitor-api", ReservedConcurrentExecutions=0
        )
        self.assertEqual(result, {"throttled": True, "function": "finance-monitor-api"})

    def test_does_nothing_unless_the_alarm_is_firing(self):
        for state in ("OK", "INSUFFICIENT_DATA", None):
            with self.subTest(state=state):
                client = mock.Mock()
                event = {} if state is None else alarm_event(state)

                result = handler.handler(event, None, client=client)

                client.put_function_concurrency.assert_not_called()
                self.assertEqual(result, {"throttled": False})


if __name__ == "__main__":
    unittest.main()
