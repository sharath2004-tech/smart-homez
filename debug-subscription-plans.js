// Temporary debug script to identify subscription plan source
// Add this to any booking page to see where plans come from

console.log('=== SUBSCRIPTION PLAN DEBUG ===');
console.log('Service data:', service);
console.log('Service subscriptionPlans:', service?.subscriptionPlans);
console.log('Service pricingPlans:', service?.pricingPlans);
console.log('hasSubscriptionPlans:', hasSubscriptionPlans);
console.log('subscriptionPlans array:', subscriptionPlans);
console.log('Component:', window.location.pathname);
console.log('==================================');