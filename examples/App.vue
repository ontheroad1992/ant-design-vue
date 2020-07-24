<template>
  <div style="width: 400px; margin: 200px auto">
    <a-select mode="tags" style="width: 100%" placeholder="Tags Mode" @change="handleChange">
      <a-select-option v-for="i in 1000" :key="(i + 9).toString(36) + i">
        {{ (i + 9).toString(36) + i }}
      </a-select-option>
    </a-select>
  </div>
</template>
<script>
export default {
  methods: {
    handleChange(value) {
      console.log(`selected ${value}`);
    },
  },
};
</script>
