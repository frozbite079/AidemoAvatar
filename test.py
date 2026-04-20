import sys
from livekit.agents.multimodal import MultimodalAgent
agent = MultimodalAgent(model=None)
print("MultimodalAgent has output:", hasattr(agent, "output"))
print("output has audio:", hasattr(agent.output, "audio") if hasattr(agent, "output") else False)
