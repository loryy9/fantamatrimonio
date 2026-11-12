<script>
  let { before, accent, lead } = $props();
</script>

<div class="page-intro-copy">
  <h1 class="page-intro-title font-serif">{before} <em>{accent}</em></h1>
  <p class="page-intro-lead">{lead}</p>
</div>

<style>
  .page-intro-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .page-intro-title {
    font-size: clamp(2.2rem, 4vw, 3.1rem);
    color: var(--wine);
    line-height: 1.08;
    margin: 0 0 10px;
    font-weight: 700;
  }

  .page-intro-title em {
    font-style: italic;
    font-weight: 400;
    border-bottom: 2px solid #ecd189;
    padding-bottom: 1px;
  }

  .page-intro-lead {
    font-family: var(--font-sans);
    font-size: 1rem;
    font-style: normal;
    color: #6a5e64;
    line-height: 1.5;
    max-width: 48ch;
    margin: 0;
  }

  @media (max-width: 900px) {
    .page-intro-copy {
      align-items: center;
      text-align: center;
    }

    .page-intro-lead {
      margin: 0 auto;
    }
  }
</style>
