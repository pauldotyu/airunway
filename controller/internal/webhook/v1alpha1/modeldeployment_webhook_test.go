/*
Copyright 2026.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubeairunwayv1alpha1 "github.com/kaito-project/kubeairunway/controller/api/v1alpha1"
	// TODO (user): Add any additional imports if needed
)

var _ = Describe("ModelDeployment Webhook", func() {
	var (
		obj       *kubeairunwayv1alpha1.ModelDeployment
		oldObj    *kubeairunwayv1alpha1.ModelDeployment
		validator ModelDeploymentCustomValidator
		defaulter ModelDeploymentCustomDefaulter
	)

	BeforeEach(func() {
		obj = &kubeairunwayv1alpha1.ModelDeployment{}
		oldObj = &kubeairunwayv1alpha1.ModelDeployment{}
		validator = ModelDeploymentCustomValidator{}
		Expect(validator).NotTo(BeNil(), "Expected validator to be initialized")
		defaulter = ModelDeploymentCustomDefaulter{}
		Expect(defaulter).NotTo(BeNil(), "Expected defaulter to be initialized")
		Expect(oldObj).NotTo(BeNil(), "Expected oldObj to be initialized")
		Expect(obj).NotTo(BeNil(), "Expected obj to be initialized")
	})

	AfterEach(func() {
		// TODO (user): Add any teardown logic common to all tests
	})

	Context("When creating ModelDeployment under Defaulting Webhook", func() {
		It("Should default serving mode to aggregated when no prefill/decode", func() {
			obj.Spec.Model.ID = "test-model"
			defaulter.Default(ctx, obj)
			Expect(obj.Spec.Serving).NotTo(BeNil())
			Expect(obj.Spec.Serving.Mode).To(Equal(kubeairunwayv1alpha1.ServingModeAggregated))
		})

		It("Should infer disaggregated mode when prefill and decode are present", func() {
			obj.Spec.Model.ID = "test-model"
			obj.Spec.Scaling = &kubeairunwayv1alpha1.ScalingSpec{
				Prefill: &kubeairunwayv1alpha1.ComponentScalingSpec{
					Replicas: 1,
					GPU:      &kubeairunwayv1alpha1.GPUSpec{Count: 2, Type: "nvidia.com/gpu"},
				},
				Decode: &kubeairunwayv1alpha1.ComponentScalingSpec{
					Replicas: 2,
					GPU:      &kubeairunwayv1alpha1.GPUSpec{Count: 1, Type: "nvidia.com/gpu"},
				},
			}
			defaulter.Default(ctx, obj)
			Expect(obj.Spec.Serving.Mode).To(Equal(kubeairunwayv1alpha1.ServingModeDisaggregated))
		})

		It("Should not override explicit serving mode", func() {
			obj.Spec.Model.ID = "test-model"
			obj.Spec.Serving = &kubeairunwayv1alpha1.ServingSpec{
				Mode: kubeairunwayv1alpha1.ServingModeAggregated,
			}
			defaulter.Default(ctx, obj)
			Expect(obj.Spec.Serving.Mode).To(Equal(kubeairunwayv1alpha1.ServingModeAggregated))
		})
	})

	Context("When creating or updating ModelDeployment under Validating Webhook", func() {
		// TODO (user): Add logic for validating webhooks
		// Example:
		// It("Should deny creation if a required field is missing", func() {
		//     By("simulating an invalid creation scenario")
		//     obj.SomeRequiredField = ""
		//     Expect(validator.ValidateCreate(ctx, obj)).Error().To(HaveOccurred())
		// })
		//
		// It("Should admit creation if all required fields are present", func() {
		//     By("simulating an invalid creation scenario")
		//     obj.SomeRequiredField = "valid_value"
		//     Expect(validator.ValidateCreate(ctx, obj)).To(BeNil())
		// })
		//
		// It("Should validate updates correctly", func() {
		//     By("simulating a valid update scenario")
		//     oldObj.SomeRequiredField = "updated_value"
		//     obj.SomeRequiredField = "updated_value"
		//     Expect(validator.ValidateUpdate(ctx, oldObj, obj)).To(BeNil())
		// })
	})

})
