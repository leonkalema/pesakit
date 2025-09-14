<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>PesaKit Svelte Demo</title>
	<meta name="description" content="Production-ready PesaPal integration with Svelte" />
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Navigation -->
	<nav class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center">
					<a href="/" class="flex items-center space-x-2">
						<div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
							<span class="text-white font-bold text-sm">P</span>
						</div>
						<span class="text-xl font-bold text-gray-900">PesaKit</span>
					</a>
				</div>
				<div class="flex items-center space-x-4">
					<a href="/" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
						Home
					</a>
					<a href="/payment" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
						Payment
					</a>
					<a href="/status" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
						Status
					</a>
				</div>
			</div>
		</div>
	</nav>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
		{@render children?.()}
	</main>

	<!-- Footer -->
	<footer class="bg-white border-t border-gray-200 mt-auto">
		<div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
			<div class="text-center text-sm text-gray-500">
				<p>© 2024 PesaKit Demo. Built with Svelte & Tailwind CSS.</p>
				<p class="mt-1">
					Powered by <a href="https://github.com/leonkalema/pesakit" class="text-primary-600 hover:text-primary-700">PesaKit</a>
				</p>
			</div>
		</div>
	</footer>
</div>
