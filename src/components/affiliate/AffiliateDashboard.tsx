import React, { useState, useEffect, useCallback } from 'react';
import { useATProto } from '../../hooks/useATProto';
import { ATAffiliateService } from '../../services/affiliate/ATAffiliateService';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Alert,
  Tabs,
  Statistic,
  Row,
  Col,
  Typography,
  Space,
} from 'antd';
import { Line, Pie } from '@ant-design/charts';
import {
  CopyOutlined,
  LinkOutlined,
  DollarOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Title } = Typography;
const { TabPane } = Tabs;

interface AffiliateStats {
  clicks: number;
  conversions: number;
  earnings: number;
  period: 'day' | 'week' | 'month' | 'year';
}

export function AffiliateDashboard() {
  const { agent } = useATProto();
  const _affiliateService = new ATAffiliateService(agent);

  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [programs, setPrograms] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<
    'day' | 'week' | 'month' | 'year'
  >('month');

  const _loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, programsData, linksData] = await Promise.all([
        affiliateService.getAffiliateStats(
          agent.session?.did || '',
          timePeriod
        ),
        affiliateService.getAffiliatePrograms(),
        affiliateService.getAffiliateLinks(agent.session?.did || ''),
      ]);

      setStats(statsData);
      setPrograms(programsData);
      setLinks(linksData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [agent.session?.did, timePeriod]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const _handleCreateProgram = async (values: any) => {
    try {
      setLoading(true);
      await affiliateService.createAffiliateProgram({
        name: values.name,
        description: values.description,
        commission: values.commission,
        requirements: values.requirements.split('\n'),
        terms: values.terms,
      });
      setShowCreateProgram(false);
      loadDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to create program');
    } finally {
      setLoading(false);
    }
  };

  const _handleCreateLink = async (values: any) => {
    try {
      setLoading(true);
      await affiliateService.createAffiliateLink(
        selectedProgram!,
        values.customId
      );
      setShowCreateLink(false);
      loadDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  const _renderStats = () => (
    <Row gutter={[16, 16]} className="mb-8">
      <Col span={6}>
        <Card>
          <Statistic
            title="Total Clicks"
            value={stats?.clicks || 0}
            prefix={<LinkOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Conversions"
            value={stats?.conversions || 0}
            prefix={<UserOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Earnings"
            value={stats?.earnings || 0}
            precision={2}
            prefix={<DollarOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Conversion Rate"
            value={stats ? (stats.conversions / stats.clicks) * 100 : 0}
            precision={2}
            suffix="%"
          />
        </Card>
      </Col>
    </Row>
  );

  const _renderCharts = () => (
    <Row gutter={[16, 16]} className="mb-8">
      <Col span={12}>
        <Card title="Earnings Trend">
          <Line
            data={[]} // Add your time-series data here
            xField="date"
            yField="earnings"
            point={{ size: 5, shape: 'diamond' }}
            label={{ style: { fill: '#aaa' } }}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card title="Conversion Distribution">
          <Pie
            data={[]} // Add your conversion distribution data here
            angleField="value"
            colorField="type"
            radius={0.8}
            label={{ type: 'outer' }}
          />
        </Card>
      </Col>
    </Row>
  );

  const _programColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Commission',
      dataIndex: 'commission',
      key: 'commission',
      render: (val: number) => `${val}%`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text: string, record: any) => (
        <Space>
          <Button
            type="primary"
            onClick={() => {
              setSelectedProgram(record.uri);
              setShowCreateLink(true);
            }}
          >
            Create Link
          </Button>
          <Button
            onClick={() => {
              // View program details
            }}
          >
            View Details
          </Button>
        </Space>
      ),
    },
  ];

  const _linkColumns = [
    {
      title: 'Custom ID',
      dataIndex: 'customId',
      key: 'customId',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text: string, record: any) => (
        <Button
          icon={<CopyOutlined />}
          onClick={() => {
            navigator.clipboard.writeText(record.uri);
          }}
        >
          Copy Link
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Title level={2}>Affiliate Dashboard</Title>

      {error && (
        <Alert message={error} type="error" showIcon className="mb-4" />
      )}

      <div className="mb-4">
        <Space>
          <Select
            value={timePeriod}
            onChange={setTimePeriod}
            style={{ width: 120 }}
          >
            <Select.Option value="day">Today</Select.Option>
            <Select.Option value="week">This Week</Select.Option>
            <Select.Option value="month">This Month</Select.Option>
            <Select.Option value="year">This Year</Select.Option>
          </Select>
          <Button type="primary" onClick={() => setShowCreateProgram(true)}>
            Create Program
          </Button>
        </Space>
      </div>

      {renderStats()}
      {renderCharts()}

      <Tabs defaultActiveKey="programs">
        <TabPane tab="Programs" key="programs">
          <Table
            columns={programColumns}
            dataSource={programs}
            loading={loading}
            rowKey="uri"
          />
        </TabPane>
        <TabPane tab="Links" key="links">
          <Table
            columns={linkColumns}
            dataSource={links}
            loading={loading}
            rowKey="uri"
          />
        </TabPane>
      </Tabs>

      <Modal
        title="Create Affiliate Program"
        open={showCreateProgram}
        onCancel={() => setShowCreateProgram(false)}
        footer={null}
      >
        <Form onFinish={handleCreateProgram}>
          <Form.Item
            name="name"
            label="Program Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true }]}
          >
            <Input.TextArea />
          </Form.Item>
          <Form.Item
            name="commission"
            label="Commission (%)"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item
            name="requirements"
            label="Requirements"
            rules={[{ required: true }]}
          >
            <Input.TextArea placeholder="Enter requirements (one per line)" />
          </Form.Item>
          <Form.Item name="terms" label="Terms" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Program
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Create Affiliate Link"
        open={showCreateLink}
        onCancel={() => setShowCreateLink(false)}
        footer={null}
      >
        <Form onFinish={handleCreateLink}>
          <Form.Item
            name="customId"
            label="Custom ID"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Link
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
