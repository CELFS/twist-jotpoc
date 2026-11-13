"""Summarize Android CI timings and compare each ABI with its last successful build.
Usage in Actions: python3 -I .github/packages/android-timings.py >> "$GITHUB_STEP_SUMMARY"
Requires GH_TOKEN with actions:read, GITHUB_REPOSITORY and GITHUB_RUN_ID.
"""
import json
import os
import subprocess
from datetime import datetime
from urllib.parse import urlencode


def api(path):
    response = subprocess.check_output(
        ["gh", "api", f"repos/{os.environ['GITHUB_REPOSITORY']}/actions/{path}"], text=True
    )
    return json.loads(response)


def elapsed(start, end):
    return int((datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds())


def duration(seconds):
    return f"{seconds // 60}m {seconds % 60:02d}s"


def builds(run):
    jobs = api(f"runs/{run['id']}/jobs?per_page=100")["jobs"]
    result = {}
    for job in jobs:
        # The reusable workflow's job name includes the Android package from the matrix.
        package = next((field for field in job["name"].split(", ") if field.startswith("android-")), None)
        if not package:
            continue
        steps = {step["name"]: step for step in job["steps"] if step["conclusion"] in {"success", "failure"}}
        upload = next((step for name, step in steps.items() if name.startswith("Run actions/upload-artifact@")), None)
        ready = elapsed(run["created_at"], upload["completed_at"]) if upload and upload["conclusion"] == "success" else None
        result[package] = ready, steps, job
    return result


def main():
    current = api(f"runs/{os.environ['GITHUB_RUN_ID']}")
    android = builds(current)
    previous = {}
    # A retried job can start long after the original workflow was created.
    query = urlencode({"branch": current["head_branch"], "status": "completed", "per_page": 20})
    history = api(f"workflows/{current['workflow_id']}/runs?{query}")["workflow_runs"]
    for run in history:
        if run["run_number"] >= current["run_number"] or run["run_attempt"] != 1:
            continue
        for abi, (ready, _, job) in builds(run).items():
            if ready is not None and job["conclusion"] == "success":
                previous.setdefault(abi, (ready, run["html_url"]))
        if android.keys() <= previous.keys():
            break

    print("### Android time to validated artifact")
    print("Measured from workflow creation through artifact upload, including runner queues and shared NDK preparation.\n")
    if current["run_attempt"] != 1:
        print("This is a rerun. Its elapsed time includes the wait before retrying; no savings are calculated.\n")
    print("| ABI | This run | Previous successful build | Time saved |")
    print("| --- | ---: | ---: | ---: |")
    for abi, (ready, _, job) in sorted(android.items()):
        baseline = previous.get(abi)
        before = f"[{duration(baseline[0])}]({baseline[1]})" if baseline else "—"
        delta = f"{baseline[0] - ready:+d}s" if baseline and ready is not None and current["run_attempt"] == 1 else "—"
        now = duration(ready) if ready is not None else (job["conclusion"] or job["status"])
        print(f"| {abi} | [{now}]({job['html_url']}) | {before} | {delta} |")

    phases = ["Restore Android NDK", "Set up Gradle caching", "Package installer",
              "Sign Android release", "Validate installer size and Android architecture"]
    print("\n| ABI | NDK | Gradle setup | Package | Sign | Validate | Upload |")
    print("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for abi, (_, steps, _) in sorted(android.items()):
        upload_name = next((name for name in steps if name.startswith("Run actions/upload-artifact@")), "")
        times = [duration(elapsed(steps[name]["started_at"], steps[name]["completed_at"]))
                 if name in steps else "—" for name in [*phases, upload_name]]
        print(f"| {abi} | " + " | ".join(times) + " |")


if __name__ == "__main__":
    main()
