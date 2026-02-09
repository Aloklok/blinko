import json
import sys

def analyze_har(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    log = data.get('log', {})
    entries = log.get('entries', [])

    print(f"Total Requests: {len(entries)}")
    
    # Sort entries by total time
    slowest = sorted(entries, key=lambda x: x.get('time', 0), reverse=True)[:15]
    
    print("\n--- TOP 15 SLOWEST REQUESTS ---")
    print(f"{'Time (ms)':<10} | {'Status':<6} | {'Size (KB)':<10} | {'URL'}")
    print("-" * 80)
    for e in slowest:
        url = e.get('request', {}).get('url', 'N/A')
        time = e.get('time', 0)
        status = e.get('response', {}).get('status', 'N/A')
        size = e.get('response', {}).get('content', {}).get('size', 0) / 1024
        print(f"{time:<10.2f} | {status:<6} | {size:<10.2f} | {url[:100]}")

    # Sort entries by size
    largest = sorted(entries, key=lambda x: x.get('response', {}).get('content', {}).get('size', 0), reverse=True)[:15]
    
    print("\n--- TOP 15 LARGEST REQUESTS ---")
    print(f"{'Size (KB)':<10} | {'Time (ms)':<10} | {'URL'}")
    print("-" * 80)
    for e in largest:
        url = e.get('request', {}).get('url', 'N/A')
        time = e.get('time', 0)
        size = e.get('response', {}).get('content', {}).get('size', 0) / 1024
        print(f"{size:<10.2f} | {time:<10.2f} | {url[:100]}")

    # Analyze Wait vs Receive time for slow requests
    print("\n--- TIMING BREAKDOWN (Slowest) ---")
    print(f"{'Wait':<8} | {'Receive':<8} | {'Connect':<8} | {'URL'}")
    print("-" * 80)
    for e in slowest[:10]:
        t = e.get('timings', {})
        url = e.get('request', {}).get('url', 'N/A')
        wait = t.get('wait', 0)
        receive = t.get('receive', 0)
        connect = t.get('connect', 0)
        print(f"{wait:<8.1f} | {receive:<8.1f} | {connect:<8.1f} | {url[:100]}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 analyze_har.py <file_path>")
    else:
        analyze_har(sys.argv[1])
