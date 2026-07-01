# Common Dev Patterns

## Query Hook

```typescript
// src/hooks/useExample.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useExample() {
  return useQuery({
    queryKey: ['example'],
    queryFn: async () => {
      const { data, error } = await supabase.from('table').select('*')
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

## Mutation Hook

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type ExampleInput = { name: string }

export function useCreateExample() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ExampleInput) => {
      const { data: result, error } = await supabase
        .from('table')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['example'] })
    },
  })
}
```

## Form with Validation

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const form = useForm({ resolver: zodResolver(schema) })
```

## Adding a Protected Route

```typescript
// In App.tsx
<Route
  path="/new-route"
  element={
    <ProtectedRoute>
      <NewPage />
    </ProtectedRoute>
  }
/>
```

## Query Invalidation After Mutation

Invalidate related queries so the UI stays in sync:

```typescript
queryClient.invalidateQueries({ queryKey: ['lessons'] })
queryClient.invalidateQueries({ queryKey: ['packages'] })
```
