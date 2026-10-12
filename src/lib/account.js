import { supabase } from '../supabase'

export async function deleteAccountData(uid) {
  const [{ data: photoRows, error: photosError }, { data: voiceRows, error: voiceError }] = await Promise.all([
    supabase.from('photos').select('path').eq('user_id', uid),
    supabase.from('messages').select('audio_path').eq('sender_id', uid).not('audio_path', 'is', null),
  ])
  if (photosError) throw photosError
  if (voiceError) throw voiceError

  const photoPaths = (photoRows || []).map((photo) => photo.path)
  if (photoPaths.length) {
    const { error } = await supabase.storage.from('photos').remove(photoPaths)
    if (error) throw error
  }

  const voicePaths = (voiceRows || []).map((message) => message.audio_path)
  if (voicePaths.length) {
    const { error } = await supabase.storage.from('voice-notes').remove(voicePaths)
    if (error) throw error
  }

  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error

  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) console.error('Account deleted, but local sign-out failed:', signOutError.message)
}
