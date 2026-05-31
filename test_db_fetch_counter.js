const url = 'https://gynfppklsussrhpsovic.supabase.co/rest/v1/invoice_counter?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bmZwcGtsc3Vzc3JocHNvdmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzQ5NDgsImV4cCI6MjA5MjkxMDk0OH0.1NXnbstnLlyyIqHfQ9IKWQc1zNkqnWh9hVX4Uz3jfLc';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(r => r.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(e => console.error(e));
