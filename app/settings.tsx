import React, { useLayoutEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/lib/store/theme';
import { useProfileStore } from '@/lib/store/profile';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { scheme } = useThemeStore();
  const displayNameValue = useProfileStore((s) => s.displayName);
  const usernameValue = useProfileStore((s) => s.username);
  const bioValue = useProfileStore((s) => s.bio);
  const emailValue = useProfileStore((s) => s.email);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  const setUsername = useProfileStore((s) => s.setUsername);
  const setBio = useProfileStore((s) => s.setBio);
  const setEmail = useProfileStore((s) => s.setEmail);

  const [displayName, setDisplayNameLocal] = useState(displayNameValue);
  const [username, setUsernameLocal] = useState(usernameValue);
  const [bio, setBioLocal] = useState(bioValue);
  const [email, setEmailLocal] = useState(emailValue);

  useLayoutEffect(() => {
    navigation.setOptions?.({ title: 'Settings' });
  }, [navigation]);

  const save = () => {
    // Simple validation for username
    const slug = String(username).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 24) || 'me';
    setDisplayName(displayName.trim() || 'Traveler');
    setUsername(slug);
    setBio(bio);
    setEmail(email.trim());
    Alert.alert('Saved', 'Your profile has been updated.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView className="flex-1 bg-white dark:bg-black" contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Text weight="semibold" style={{ fontSize: 16, marginBottom: 12, color: scheme === 'dark' ? '#e5e7eb' : '#111827' }}>Edit Profile</Text>

          <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayNameLocal}
            placeholder="Your name"
            placeholderTextColor={scheme === 'dark' ? '#6b7280' : '#9ca3af'}
            style={{ borderWidth: 1, borderColor: scheme === 'dark' ? '#374151' : '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: scheme === 'dark' ? '#e5e7eb' : '#111827', marginTop: 6, marginBottom: 14 }}
          />

          <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsernameLocal}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={scheme === 'dark' ? '#6b7280' : '#9ca3af'}
            style={{ borderWidth: 1, borderColor: scheme === 'dark' ? '#374151' : '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: scheme === 'dark' ? '#e5e7eb' : '#111827', marginTop: 6, marginBottom: 14 }}
          />

          <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmailLocal}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={scheme === 'dark' ? '#6b7280' : '#9ca3af'}
            style={{ borderWidth: 1, borderColor: scheme === 'dark' ? '#374151' : '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: scheme === 'dark' ? '#e5e7eb' : '#111827', marginTop: 6, marginBottom: 14 }}
          />

          <Text style={{ color: scheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBioLocal}
            placeholder="Tell people a bit about you"
            placeholderTextColor={scheme === 'dark' ? '#6b7280' : '#9ca3af'}
            multiline
            numberOfLines={4}
            style={{ borderWidth: 1, borderColor: scheme === 'dark' ? '#374151' : '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: scheme === 'dark' ? '#e5e7eb' : '#111827', marginTop: 6 }}
          />

          <View style={{ marginTop: 16 }}>
            <Button label="Save" onPress={save} />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
