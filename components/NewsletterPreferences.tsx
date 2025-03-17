import React, { useState } from 'react';
import { Switch, Button, Select, MenuItem } from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';

interface NewsletterPreferences {
  topics: string[];
  frequency: 'daily' | 'weekly';
  time: string;
  days: string[];
  notificationMethod: 'email' | 'sms' | 'both';
  enabled: boolean;
}

const NewsletterPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<NewsletterPreferences>({
    topics: [],
    frequency: 'daily',
    time: '09:00',
    days: ['Monday'],
    notificationMethod: 'email',
    enabled: false,
  });

  const topicOptions = [
    'Artificial Intelligence',
    'Machine Learning',
    'Deep Learning',
    'Natural Language Processing',
    'Robotics',
    'Computer Vision',
  ];

  const handleSavePreferences = async () => {
    try {
      await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  return (
    <div className="newsletter-preferences">
      <h2>Newsletter Preferences</h2>
      
      <div className="preference-section">
        <h3>Topics of Interest</h3>
        <Select
          mode="multiple"
          placeholder="Select topics"
          value={preferences.topics}
          onChange={(topics) => setPreferences({ ...preferences, topics })}
          options={topicOptions}
        />
      </div>

      <div className="preference-section">
        <h3>Frequency</h3>
        <Select
          value={preferences.frequency}
          onChange={(frequency) => setPreferences({ ...preferences, frequency })}
          options={[
            { label: 'Daily', value: 'daily' },
            { label: 'Weekly', value: 'weekly' },
          ]}
        />
      </div>

      <div className="preference-section">
        <h3>Delivery Time</h3>
        <TimePicker
          value={preferences.time}
          onChange={(time) => setPreferences({ ...preferences, time })}
          format="HH:mm"
        />
      </div>

      <div className="preference-section">
        <h3>Notification Method</h3>
        <Select
          value={preferences.notificationMethod}
          onChange={(method) => setPreferences({ ...preferences, notificationMethod: method })}
          options={[
            { label: 'Email', value: 'email' },
            { label: 'SMS', value: 'sms' },
            { label: 'Both', value: 'both' },
          ]}
        />
      </div>

      <div className="preference-section">
        <h3>Enable Newsletter</h3>
        <Switch
          checked={preferences.enabled}
          onChange={(enabled) => setPreferences({ ...preferences, enabled })}
        />
      </div>

      <Button onClick={handleSavePreferences}>Save Preferences</Button>
    </div>
  );
};

export default NewsletterPreferences; 