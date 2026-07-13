const message = ref('')

export const useGlobalLoading = () => {
  const loading = useState('global-loading', () => false)

  const start = (msg?: string) => {
    if (msg) message.value = msg
    loading.value = true
  }

  const finish = () => {
    loading.value = false
    message.value = '' // reset
  }

  return { loading, start, finish, message }
}
