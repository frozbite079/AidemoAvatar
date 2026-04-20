import sys
from livekit.agents import pipeline
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.agents import multimodal
try:
    from livekit.agents import AgentSession
    print("AgentSession exists:", AgentSession)
    print("AgentSession IS VoicePipelineAgent?", AgentSession is VoicePipelineAgent)
except:
    print("No AgentSession")

import livekit.plugins.google as plugin_google
try:
    print("Google realtime model:", plugin_google.realtime.RealtimeModel)
except:
    print("No google realtime")
