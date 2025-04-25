import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useTable } from 'react-table';
import axios from 'axios';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    total_files: 0,
    total_calls_made: 0,
    total_pickups: 0,
    pickup_rate: 0,
    cr_rate: 0,
    total_responses: 0,
    duplicated: 0,
    total_responses_after: 0,
    data: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/ivr');
      setMetrics(res.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const columns = metrics.data.length > 0
    ? Object.keys(metrics.data[0]).map((key, i) => ({
        Header: `Column ${i}`,
        accessor: key
      }))
    : [];
  const tableInstance = useTable({ columns, data: metrics.data });

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

  const chartData = {
    labels: metrics.data.map((_, i) => `Response ${i + 1}`),
    datasets: [
      {
        label: 'Key Press Value',
        data: metrics.data.map(row => row[1] || 0),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="container">
      <h1>PKR Election April 2025 - IVR Dashboard</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="metrics">
            <p>Total Files Loaded: {metrics.total_files}</p>
            <p>Total Calls Made: {metrics.total_calls_made}</p>
            <p>Total Pick-ups: {metrics.total_pickups}</p>
            <p>Pickup Rate: {metrics.pickup_rate}%</p>
            <p>CR Rate: {metrics.cr_rate}%</p>
            <p>Total Responses: {metrics.total_responses}</p>
            <p>Duplicated Responses: {metrics.duplicated}</p>
            <p>Responses After Deduplication: {metrics.total_responses_after}</p>
          </div>
          <div className="chart">
            <Line data={chartData} options={{ responsive: true }} />
          </div>
          <div className="table">
            <h2>Responses</h2>
            <table {...getTableProps()}>
              <thead>
                {headerGroups.map(headerGroup => (
                  <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                      <th {...column.getHeaderProps()}>{column.render('Header')}</th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody {...getTableBodyProps()}>
                {rows.map(row => {
                  prepareRow(row);
                  return (
                    <tr {...row.getRowProps()}>
                      {row.cells.map(cell => (
                        <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}