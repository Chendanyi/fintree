import type { TreeData } from '../types/financialTree'

export const MOCK_TREE_DATA: TreeData = {
  stockSymbol: 'CRCL.N (Circle Internet Group)',
  basePrice: 65.69,
  lastUpdated: '2026-07-19',
  timelineLanes: ['2026 H2', '2027', '2028-2029', '2031'],
  nodes: [
    {
      id: 'node_root',
      lane: '2026 H2',
      title: 'Visa & Stripe OUSD Launch',
      description:
        'Visa稳定币平台与Stripe默认选择OUSD落地，竞争威胁变现',
      isLockedFact: true,
      childrenIds: ['path_a_share', 'path_b_keep'],
    },
    {
      id: 'path_a_share',
      lane: '2027',
      title: '路径 A：模仿让利',
      description:
        '分享USDC储备收益给Visa/Stripe分销渠道，保住分销份额',
      isLockedFact: false,
      financialImpact: {
        cagrEffect: '稳定增长',
        marginEffect: '-15%利润压缩',
      },
      childrenIds: ['path_x_high_exec', 'path_y_low_exec'],
    },
    {
      id: 'path_b_keep',
      lane: '2027',
      title: '路径 B：保守坚守',
      description:
        '拒绝利益分成，维持自留费率。分销渠道持续向OUSD倾斜',
      isLockedFact: false,
      financialImpact: {
        cagrEffect: '断崖下滑',
        marginEffect: '短期维持',
      },
      childrenIds: ['path_b_failed_outcast'],
    },
    {
      id: 'path_x_high_exec',
      lane: '2028-2029',
      title: '路径 X：高效反击',
      description:
        'Arc变现成功，深化CCTP，拿下美联储主账户确立终极安全壁垒',
      isLockedFact: false,
      financialImpact: { revenueEffect: '+$3.5B' },
      childrenIds: ['leaf_bull_case'],
    },
    {
      id: 'path_y_low_exec',
      lane: '2028-2029',
      title: '路径 Y：低效停滞',
      description:
        'Arc滞留测试网，美联储主账户难落地，遭遇联盟治理摩擦反扑',
      isLockedFact: false,
      financialImpact: { revenueEffect: '+$0.4B' },
      childrenIds: ['leaf_base_case'],
    },
    {
      id: 'path_b_failed_outcast',
      lane: '2028-2029',
      title: '路径 B 后续：渠道边缘化',
      description:
        '丧失主流支付网络支持，依靠残存DeFi与跨境流动池勉强支撑',
      isLockedFact: false,
      childrenIds: ['leaf_bear_case'],
    },
    {
      id: 'leaf_bull_case',
      lane: '2031',
      title: '🎉 达成牛市案例 (Bull Case)',
      description: '成功度过OUSD威胁期，实现基建与合规双重垄断',
      isLockedFact: false,
      targetPrice: 243.0,
      cagr: '40%',
      netReserveRevenue: '$5.6B',
      cpnVolume: '$300B/年',
      childrenIds: [],
    },
    {
      id: 'leaf_base_case',
      lane: '2031',
      title: '⚖️ 中性案例 (Base Case)',
      description: '分销渠道被蚕食，虽保留核心业务但高增长估值梦碎',
      isLockedFact: false,
      targetPrice: 145.0,
      cagr: '25%',
      netReserveRevenue: '$3.2B',
      cpnVolume: '$120B/年',
      childrenIds: [],
    },
    {
      id: 'leaf_bear_case',
      lane: '2031',
      title: '⚠️ 熊市案例 (Bear Case)',
      description: '全面退守DeFi与小众跨境业务，核心估值体系完全重构',
      isLockedFact: false,
      targetPrice: 52.0,
      cagr: '5%',
      netReserveRevenue: '$0.8B',
      cpnVolume: '$30B/年',
      childrenIds: [],
    },
  ],
}
