"""Pull every figure in the MDP-249 final report from public sources.

Writes data/snapshot.json. Sources: Tableland, the Safe Transaction Service,
the public Arbitrum RPC, moondao.com's public Discord-announcement and DePrize
log endpoints (the latter wraps Etherscan V2), and the GitHub CLI.

    python3 docs/reports/eb-mdp-249/scripts/fetch_data.py
"""

import datetime as dt
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request

from Crypto.Hash import keccak

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data', 'snapshot.json')
UA = {'User-Agent': 'Mozilla/5.0 (MoonDAO EB report)'}

AS_OF = dt.datetime(2026, 10, 7, 23, 59, tzinfo=dt.timezone.utc)
TERM_START = dt.datetime(2026, 5, 1, tzinfo=dt.timezone.utc)

EB_SAFE = '0xdFc31084ad3887076913e5d0759a27C65A3C5291'
ARB_TREASURY = '0xAF26a002d716508b7e375f1f620338442F5470c0'
CITIZEN_NFT = '0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002'
TEAM_NFT = '0xAB2C354eC32880C143e87418f80ACc06334Ff55F'
JB_TERMINAL = '0x2dB6d704058E552DeFE415753465df8dF0361846'
FRANK_JB_PROJECT = 73

DEPRIZE = {
    'arbitrum': {
        'chainId': 42161,
        'registry': '0xf8B2244634c6eCeF32de10BFe0D7436413A59924',
        'mint': '0xfa36cAb21415B4e23a1eecCFe7B07693A690d838',
        'fromBlock': 495964196,
    },
    'sepolia': {
        'chainId': 11155111,
        'registry': '0x7208B0Ba9B1013000b8D30b60A462079300984E2',
        'mint': '0x22E22C4135be93595f341e072321D18e7D4Ee0D0',
        'fromBlock': 11727650,
    },
}

TABLES = {
    'projects': 'PROJECT_42161_122',
    'citizens': 'CITIZENTABLE_42161_126',
    'teams': 'TEAMTABLE_42161_127',
    'jobs': 'JOBBOARD_42161_158',
    'marketplace': 'MARKETPLACE_42161_159',
}


def keccak_hex(sig):
    h = keccak.new(digest_bits=256)
    h.update(sig.encode())
    return '0x' + h.hexdigest()


def get_json(url, data=None, retries=3):
    headers = dict(UA)
    if data is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(data).encode()
    err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            return json.load(urllib.request.urlopen(req, timeout=90))
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f'{url}: {err}')


def tableland(sql):
    return get_json('https://tableland.network/api/v1/query?statement=' + urllib.parse.quote(sql))


def safe_paged(url):
    rows = []
    while url:
        page = get_json(url)
        rows += page['results']
        url = page['next']
    return rows


def deprize_logs(chain_id, address, from_block, topic0, topic1=None):
    q = dict(chainId=chain_id, address=address, fromBlock=from_block, topic0=topic0)
    if topic1:
        q['topic1'] = topic1
    return get_json('https://www.moondao.com/api/deprize/logs?' + urllib.parse.urlencode(q))


def arb_call_batch(calls):
    body = [
        {'jsonrpc': '2.0', 'id': i, 'method': 'eth_call', 'params': [c, 'latest']}
        for i, c in enumerate(calls)
    ]
    return get_json('https://arb1.arbitrum.io/rpc', data=body)


def nft_history(address):
    total = int(
        arb_call_batch([{'to': address, 'data': keccak_hex('totalSupply()')[:10]}])[0]['result'],
        16,
    )
    sel = keccak_hex('expiresAt(uint256)')[:10]
    expires = {}
    for start in range(0, total, 50):
        ids = list(range(start, min(start + 50, total)))
        res = arb_call_batch([{'to': address, 'data': sel + hex(i)[2:].rjust(64, '0')} for i in ids])
        for r in res:
            if r.get('result') not in (None, '0x'):
                expires[ids[r['id']]] = int(r['result'], 16)
    mints = deprize_logs(
        42161, address, 0, keccak_hex('Transfer(address,address,uint256)'), '0x' + '0' * 64
    )
    minted = {int(l['topics'][3], 16): int(l['timeStamp'], 16) for l in mints['logs']}
    return {
        'totalSupply': total,
        'tokens': [
            {'id': i, 'mintedAt': minted.get(i), 'expiresAt': expires.get(i)} for i in range(total)
        ],
        'truncated': mints.get('truncated'),
    }


def words(data_hex):
    body = data_hex[2:]
    return [body[i : i + 64] for i in range(0, len(body), 64)]


def deprize_activity():
    bet = keccak_hex('Bet(uint256,address,uint256,uint256,uint256,uint256)')
    events = {
        'registered': keccak_hex('DePrizeRegistered(uint256,uint256,uint256[],uint256)'),
        'stateChanged': keccak_hex('StateChanged(uint256,uint8,uint8)'),
        'winnerDeclared': keccak_hex('WinnerDeclared(uint256,uint256)'),
        'cancellationAnnounced': keccak_hex('CancellationAnnounced(uint256,uint256,uint256)'),
    }
    out = {}
    for name, c in DEPRIZE.items():
        bets = []
        for l in deprize_logs(c['chainId'], c['mint'], c['fromBlock'], bet)['logs']:
            w = [int(x, 16) for x in words(l['data'])]
            bets.append(
                {
                    'deprizeId': int(l['topics'][1], 16),
                    'bettor': '0x' + l['topics'][2][-40:],
                    'outcomeIndex': w[0],
                    'costETH': w[2] / 1e18,
                    'sliceETH': w[3] / 1e18,
                    'timestamp': int(l['timeStamp'], 16),
                    'tx': l['transactionHash'],
                }
            )
        registry = {}
        for ev, topic in events.items():
            registry[ev] = [
                {
                    'args': [int(t, 16) for t in l['topics'][1:]],
                    'timestamp': int(l['timeStamp'], 16),
                    'tx': l['transactionHash'],
                }
                for l in deprize_logs(c['chainId'], c['registry'], c['fromBlock'], topic)['logs']
            ]
        out[name] = {'bets': bets, 'registry': registry}
    return out


def frank_payments():
    pay = keccak_hex('Pay(uint256,uint256,uint256,address,address,uint256,uint256,string,bytes,address)')
    rows = []
    for l in deprize_logs(42161, JB_TERMINAL, 0, pay)['logs']:
        if int(l['topics'][3], 16) != FRANK_JB_PROJECT:
            continue
        w = words(l['data'])
        rows.append(
            {
                'timestamp': int(l['timeStamp'], 16),
                'payer': '0x' + w[0][-40:],
                'amountETH': int(w[2], 16) / 1e18,
                'tx': l['transactionHash'],
            }
        )
    return sorted(rows, key=lambda r: r['timestamp'])


def eb_safe():
    base = 'https://api.safe.global/tx-service/arb1/api'
    txs = safe_paged(f'{base}/v2/safes/{EB_SAFE}/multisig-transactions/?limit=100&executed=true')
    incoming = safe_paged(f'{base}/v1/safes/{EB_SAFE}/incoming-transfers/?limit=100')
    balances = get_json(f'{base}/v1/safes/{EB_SAFE}/balances/?trusted=false&exclude_spam=true')
    return {'multisig': txs, 'incoming': incoming, 'balances': balances}


def treasury_inflows():
    base = 'https://api.safe.global/tx-service/arb1/api'
    rows = safe_paged(f'{base}/v1/safes/{ARB_TREASURY}/incoming-transfers/?limit=200')
    return [r for r in rows if r['type'] == 'ETHER_TRANSFER']


def announcements(pages=5):
    url = 'https://www.moondao.com/api/discord/messages?type=announcements'
    msgs = get_json(url)
    for _ in range(pages - 1):
        more = get_json(url + '&before=' + msgs[-1]['id'])
        if not more:
            break
        msgs += more
    return [
        {'id': m['id'], 'timestamp': m['timestamp'], 'content': m.get('content', '')}
        for m in msgs
        if m['timestamp'] >= '2026-04-15'
    ]


def merged_prs():
    out = subprocess.run(
        [
            'gh', 'pr', 'list', '--state', 'merged', '--limit', '1000',
            '--search', 'merged:2026-05-01..2026-10-07',
            '--json', 'number,title,author,mergedAt',
        ],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def eth_price():
    try:
        return get_json('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')[
            'ethereum'
        ]['usd']
    except RuntimeError:
        return None


def main():
    snap = {'asOf': AS_OF.isoformat(), 'fetchedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
    snap['ethPriceUSD'] = eth_price()
    snap['projects'] = tableland(
        f"SELECT id,MDP,name,quarter,year,active,finalReportIPFS,finalReportLink FROM {TABLES['projects']} WHERE MDP >= 245"
    )
    snap['teamsTable'] = tableland(f"SELECT id,name FROM {TABLES['teams']} ORDER BY id")
    snap['jobs'] = tableland(f"SELECT id,title,timestamp,endTime,teamId FROM {TABLES['jobs']} ORDER BY id")
    snap['marketplace'] = tableland(
        f"SELECT id,title,timestamp,endTime,teamId,price,currency FROM {TABLES['marketplace']} ORDER BY id"
    )
    snap['citizenNFT'] = nft_history(CITIZEN_NFT)
    snap['teamNFT'] = nft_history(TEAM_NFT)
    snap['deprize'] = deprize_activity()
    snap['frankPayments'] = frank_payments()
    snap['ebSafe'] = eb_safe()
    snap['treasuryEthInflows'] = treasury_inflows()
    snap['announcements'] = announcements()
    snap['mergedPRs'] = merged_prs()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(snap, f, indent=1, default=str)
    print('wrote', os.path.relpath(OUT))


if __name__ == '__main__':
    main()
