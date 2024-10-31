**Control Strategies for Physically Simulated Characters Performing Two-player Competitive Sports**

*JUNGDAMWON, et. al., FacebookAIResearch, USA, 2021.*

Blog by Hanbie Ryu, 2024
Dept. of AI, Yonsei University

This paper focuses on training agents to perform competitive sports like boxing or fencing with human-like motion. Although this is directly related to my research area of interest, I'm not at all in a professional enough level to provide a deeper insight than a sort of brief, superficial overview. This is just my little interpretation and breakdown of the research, intended for a broader audience. Enjoy!

We will divide this blog into the following sections:

Index:
    - Theoretical background and need for research
    - Training Procedure
    - Model Architectures
    - Results and Analysis

<h1>Theoretical background and need for research</h1>

1. What is reinforcement learning?

Reinforcement Learning (RL) is a type of machine learning where an "agent" learns to make decisions by taking actions in an environment to maximize cumulative rewards. In other categories of machine learning, i.e. supervised and unsupervised learning, the goal is to come up with a function given an input to either produce a desireable output, or find meaningful features from the given data. RL works in a similar way:

The agent is given an envrionment (virtual, in most cases) to be trained in. This can be a chess board, or a map in StarCraft. We can interpret the environment at a given time as a "state", usually represented as a vector S_t. The agent will be provided with this state, and will be train to make decisions for actions that will maximize some reward metric. It can be the number of oponent pieces taken in chess, or a weighted sum of enemy units killed and enemy buildings destroyed minus ally losses. The "policy" is what defines the agent's actions at each state to maximize these metrics.
The agent cannot just make decisions that maximizes immediate rewards over long-term benefits. This is why in traditional RL, we use the Q-Value (Action-Valye Function) to estimate the expected reward of taking a specific action in a specific state, and following the policy thereafter.

The specific algorithm this paper chose is PPO (Proximal Policy Optimization), where we don't use the Q-Value; instead, we update the policy directly by performing gradient ascent on the reward function with respect to the parameters. 

\[
     \nabla_\theta J(\theta) = \mathbb{E} \left[ \nabla_\theta \log \pi_\theta(a | s) \cdot A(s, a) \right]
     \]

1. Training agents to act more "humanly"
2. Competitive agents

<h1>Training Procedure</h1>

This research uses a two step approach, where the "Pre-training Phase" trains the agent to behave like the experts from the motion-capture training data, and the "Transfer Learning phase" trains the model to maximize competitive rewards, in this case, scores and penalties in boxing.

The state (that the agents will have access to) is composed of, largely, the **body state**, which holds the current positions, velocities and angular velocities of every joint in the body, and the **task-specific state**, which holds different, appropriate states for each training phase.
Our model is composed of the **Motor Decoder**, which given the current body state as an input produces N number of motor outputs from expert motion capture data, and the **Task Encoder**, which, fiven the task-specific state, produces N number of weights, which will be multiplied to each corresponding expert motor output (with some autoregressive smoothing factors for smooth transition) to compute a "weighted sum". 

In other words, the Motor Decoder produces expert motions that would follow the current state of the body, and the Task Encoder creates a combination of those motions, which would be the key in creating realistic movements for a given task.

The task-specific states and rewards are different for each phase. In the Pre-training Phase, the task-specific state holds motion sequences 0.05s and 0.15s into the future, with imitation rewards encouraging the agent to imitate the training motion data, producing realistic human-like movement.

In the Transfer Learning Phase, the task-specific state holds relative target positions of the oponent agent, and other variables that the agent would need to maximize competitive rewards. The rewards here are a weighted sum of:
   - match rewards: calculates the normal force of the punches between each agents and computes the force applied to the oponent minus from the agent
   - closeness rewards: encourages the agents to be close to eachother, increasing the likelyhood of competitive action occuring
   - facing rewards: encourages the agents to face eachother. Without this, agents will punch eachother in the back, which rarely happens in real life.
   - energy rewards: penalises excessive motor use, encouraging the agents to move more efficiently.
   - various penalties: terminates the episode if one of the agents loses balance and falls to the ground, or if the agents get stuck between eachother or on the ropes.

g𝑡 = (parena,darena, pop, vop, pglove, vglove, ptarget, vtarget)

In transitioning from the Pre-training Phase to the Transfer Learning Phase, only the Motor Decoder is reused. Meaning, it would still produce human-like expert motions that would follow a given body state, and only the weights for their combination would be reinitialized.

The Task Encoder will then be trained with an oponent agent, learning to adaptively weigh the expert actions generated by the Motor Decoder based on the competitive context. It will compute a set of weights for each expert action, emphasizing particular movements (e.g., attacking, dodging, blocking) depending on the opponent’s location and posture.

In essence, the Task Encoder serves as a strategic component, dynamically adapting the expert motions produced by the Motor Decoder to match real-time competitive needs, ensuring that each movement looks both realistic and purpose-driven.

**Preserving Movement Style During Competitive Optimization**

The Motor Decoder provides important motor information to the agent, but they may not be optimized to the task, leading to suboptimal results when the Motor Decoder parameters are fixed during Transfer Learning (*Enc-only*).

On the other hand, if the Motor Decoder parameters are optimized together with the Task Encoder parameters (*Enc-Dec-e2e*), it could lead to maximal competitive rewards, but the learned expert movements could be "forgotten" during optimization.

This is why, in the research, we alternate between Enc-only and Enc-Dec-e2e learning to preserve the pre-trained movements during competitive optimization. Specifically, we start with Enc-only for 300-500 iterations, then alternate every 50 iterations. This alternating training method provides a fine balance between movement preservation and task optimization.

<h1>Results and Analysis</h1>

[insert model specifications from (5)]

Since the agents have competitive rewards, we can expect them to follow a sort of zero-sum game.
From this paper's observation, the author divides the training curve into 5 stages:
- stage 1: cumulative rewards increase as the agents learn to stand up correctly
- stage 2: unintended collisions occur
- stage 3: develops punches -> rewards decrease towards zero
- stage 4: develops blocking and avoiding punches -> rewards bounce back
- stage 5: fluctuates between stage 3 and 4

At stage 5, the paper judges that the policy *converges* when the match rewards are around 0 during stage 5.

Similar results are shown also in fencing, where the agents learned to strike the oponent and make counter attacks. Here's a demo video showcasing the training results in boxing and fencing.

[video]

<h1>Conclusion</h1>

The results of this paper demonstrate the effectiveness of combining the **Pre-training Phase** and **Transfer Learning Phase** to develop competitive agents that exhibit both human-like movements and strategic awareness. Here are some key takeaways from the analysis:

1. **Realistic and Smooth Motion**:
   - Agents trained with this two-phase approach produce visually realistic and smooth actions that mimic natural human movements, thanks to the pre-training with motion capture data.
   - The autoregressive smoothing mechanism in the Task Encoder ensures that transitions between movements are continuous, helping the agents avoid unnatural or abrupt shifts in posture, which often occurs when blending multiple motion experts.

2. **Adaptive Competitive Behavior**:
   - During the Transfer Learning Phase, agents learned to adapt their actions dynamically based on the opponent’s position and behavior. For instance, they would close the distance between themselves and the opponent, maintain proper orientation (facing rewards), and conserve energy by avoiding excessive or repetitive motions.
   - The agents could shift fluidly between offense and defense, reacting to incoming attacks by dodging or counterattacking, showcasing strategic depth in their learned behavior.

3. **Diverse Range of Movement Styles**:
   - By tuning the weights of different experts, the Task Encoder was able to generate a range of distinct movement styles. For example, some agents adopted more defensive stances, waiting for the opponent to approach before striking, while others leaned towards aggressive, high-energy attacks.
   - This variety in movement allowed the agents to exhibit individual styles, making interactions more engaging and closer to real-life competitive scenarios.

4. **Evaluation Metrics**:
   - Quantitative metrics, such as the cumulative competitive rewards (combining match rewards, energy rewards, and penalties), showed significant improvements after transfer learning, as agents were able to maximize points by hitting the opponent with precise, forceful strikes while maintaining efficiency and stability.
   - Comparisons with baseline models that lacked the pre-training phase highlighted the importance of starting with imitation learning to ensure realistic motion and stability in competitive play.

5. **Limitations and Observed Challenges**:
   - Although the model produced impressive results, certain limitations were observed. For instance, in some cases, agents struggled with unusual opponent behavior or unexpected contact, leading to awkward responses.
   - Additionally, the reward structure required careful tuning to balance aggressiveness and defensive postures, as overly aggressive agents risked penalties, while too-defensive agents received lower match rewards.

6. **Visual Quality and Real-World Applicability**:
   - The results highlight the potential of this approach for applications beyond boxing, such as other two-player sports or complex interactive games requiring lifelike character animations.
   - The visually realistic and adaptable movement styles generated by the agents suggest that this framework could be extended to various types of interactive simulations, from sports games to training simulations in virtual environments.

In conclusion, this research effectively demonstrates that combining imitation learning with reinforcement learning can produce agents that not only perform competitively but also move with the fluidity and nuance of real athletes. The strategic depth achieved through the Task Encoder and Motor Decoder framework shows promise for future applications, particularly in fields requiring adaptive, human-like behaviors in virtual characters.