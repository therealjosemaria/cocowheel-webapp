"""Mac-only installer. Receives worker configuration on stdin; never prints keys."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runtime',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parent
runtime=str(args.runtime.absolute())  # Preserve the venv executable symlink/prefix.
subprocess.run([runtime,'-c','import sys,mediapipe; assert sys.version_info[:2]==(3,12); assert mediapipe.__version__=="0.10.21"'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
config=json.load(sys.stdin)
if len(config.get('key',''))<43 or not config.get('origin','').startswith('https://'): raise ValueError('Invalid configuration')
config['spool']=str(root/'private-tmp')
os.chmod(root,0o700)
target=root/'config.json'
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as stream: json.dump(config,stream)
os.chmod(target,0o600)
agent=Path.home()/'Library/LaunchAgents/com.gumwheel.avatar-photo-worker.plist'
value={'Label':'com.gumwheel.avatar-photo-worker','ProgramArguments':[runtime,str(root/'worker.py'),'--config',str(target)],
 'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':30,'WorkingDirectory':str(root),
 'StandardOutPath':str(root/'worker.log'),'StandardErrorPath':str(root/'worker-error.log'),
 'EnvironmentVariables':{'PYTHONUNBUFFERED':'1'}}
agent.write_bytes(plistlib.dumps(value)); os.chmod(agent,0o600)
domain='gui/'+str(os.getuid())
subprocess.run(['launchctl','bootout',domain,str(agent)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['launchctl','bootstrap',domain,str(agent)],check=True)
print('Gumwheel photo worker installed for the logged-in Mac user.')
